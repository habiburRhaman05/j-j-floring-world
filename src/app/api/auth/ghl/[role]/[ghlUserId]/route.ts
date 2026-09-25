import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api/api-route";
import { requestMeta, writeAudit } from "@/lib/auth/audit";
import { issueSession, setAuthCookies } from "@/lib/auth/session.server";
import { getGhlConnection, getGhlUser, isLocationUser } from "@/lib/ghl/client";

/* ==========================================================================
   GHL auto-login  -  /csr/{{user.id}}  and  /sales-rep/{{user.id}}
   --------------------------------------------------------------------------
   proxy.ts rewrites those two custom-menu-link shapes to this handler. The
   checks, in order:
     1. the link's key matches GHL_AUTOLOGIN_KEY (when that is set)
     2. GHL knows the user, it is not deleted, and it belongs to this sub-account
     3. our database has an ACTIVE user with that ghlUserId
     4. that user's app role matches the dashboard the link points at
   Then it signs in through the same issueSession() as the password login and
   redirects to the dashboard. Any failure lands on /login with a reason.

   A GHL user id is not a secret, which is why step 1 exists: without a key,
   anyone who learns an id could open the link.
   ========================================================================== */

const LINK_ROLES: Record<string, { roleKey: "csr" | "sales_rep"; home: string }> = {
  csr: { roleKey: "csr", home: "/csr" },
  "sales-rep": { roleKey: "sales_rep", home: "/sales-rep" },
};

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const GET = apiRoute(
  async (request: NextRequest, { params }: { params: Promise<{ role: string; ghlUserId: string }> }) => {
    const { role, ghlUserId } = await params;
    const meta = requestMeta(request);

    const fail = async (reason: string, detail?: Record<string, unknown>) => {
      await writeAudit({
        action: "auth.ghl_login.failed",
        entity: "User",
        entityId: ghlUserId,
        after: { reason, role, ...detail },
        ...meta,
      }).catch(() => {});
      const login = new URL("/login", request.url);
      login.searchParams.set("error", reason);
      return NextResponse.redirect(login);
    };

    const target = LINK_ROLES[role];
    if (!target) return fail("ghl_link_invalid");
    // An unrendered merge field ("{{user.id}}") or anything that is not a GHL id.
    if (!/^[A-Za-z0-9]{10,64}$/.test(ghlUserId)) return fail("ghl_link_invalid");

    const expectedKey = process.env.GHL_AUTOLOGIN_KEY;
    if (expectedKey && !sameSecret(request.nextUrl.searchParams.get("key"), expectedKey)) {
      return fail("ghl_link_key");
    }

    const connection = await getGhlConnection();
    if (!connection) return fail("ghl_not_connected");

    let ghlUser;
    try {
      ghlUser = await getGhlUser(connection, ghlUserId);
    } catch {
      return fail("ghl_unreachable");
    }
    if (!ghlUser || !isLocationUser(ghlUser, connection.locationId)) {
      return fail("ghl_user_invalid");
    }

    const user = await prisma.user.findUnique({
      where: { ghlUserId },
      include: { roles: { include: { role: true } } },
    });
    if (!user || user.deletedAt) return fail("ghl_user_not_in_app");
    if (user.status !== "ACTIVE") return fail("account_inactive");
    if (!user.roles.some((ur) => ur.role.key === target.roleKey)) {
      return fail("ghl_wrong_role", { appRole: user.role });
    }

    const issued = await issueSession(user.id, meta, "ghl");
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit({
      actorId: user.id,
      action: "auth.ghl_login.succeeded",
      entity: "User",
      entityId: user.id,
      after: { role: target.roleKey },
      ...meta,
    });

    const response = NextResponse.redirect(new URL(target.home, request.url));
    setAuthCookies(response.cookies, issued);
    return response;
  },
);
