import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api/api-route";
import { requestMeta, writeAudit } from "@/lib/auth/audit";
import type { SessionScope } from "@/lib/auth/cookie-names";
import { issueSession, setAuthCookies } from "@/lib/auth/session.server";
import { getGhlConnection, getGhlUser, isLocationUser } from "@/lib/ghl/client";

/* ==========================================================================
   GHL auto-login  -  custom menu links
   --------------------------------------------------------------------------
     /csr/{{user.id}}?key=...        CSR dashboard
     /sales-rep/{{user.id}}?key=...  Sales Rep dashboard
     /admin/{{location.id}}          Admin dashboard

   proxy.ts rewrites those shapes to this handler (via the /auth/ghl spinner
   page). Each signs in to its own dashboard's session (cookie-names.ts), so
   the same browser can hold an Admin, a CSR and a Sales Rep session at once.

   CSR / Sales Rep, in order:
     1. the link's key matches GHL_AUTOLOGIN_KEY (when that is set)
     2. GHL knows the user, it is not deleted, and it belongs to this location
     3. our database has an ACTIVE user with that ghlUserId
     4. that user's app role matches the dashboard the link points at

   Admin, as the business owner chose: the location id must be the one saved
   at setup, and then the Admin is signed in - the account owner recorded at
   setup, else the longest-standing active Admin. There is no key and no
   per-person check on this link, so anyone who has the location id (every
   GHL user of the sub-account can see it) can open the Admin dashboard with
   it. Keep the link in an admins-only GHL menu.

   Any failure lands on /login with a reason; email/password stays available.
   ========================================================================== */

const LINK_ROLES: Record<string, { roleKey: "csr" | "sales_rep"; scope: SessionScope; home: string }> = {
  csr: { roleKey: "csr", scope: "csr", home: "/csr" },
  "sales-rep": { roleKey: "sales_rep", scope: "sales_rep", home: "/sales-rep" },
};

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const GET = apiRoute(
  async (request: NextRequest, { params }: { params: Promise<{ role: string; ghlUserId: string }> }) => {
    const { role, ghlUserId: linkId } = await params;
    const meta = requestMeta(request);

    const fail = async (reason: string, detail?: Record<string, unknown>) => {
      await writeAudit({
        action: "auth.ghl_login.failed",
        entity: "User",
        entityId: linkId,
        after: { reason, role, ...detail },
        ...meta,
      }).catch(() => {});
      const login = new URL("/login", request.url);
      login.searchParams.set("error", reason);
      return NextResponse.redirect(login);
    };

    const signIn = async (userId: string, scope: SessionScope, home: string) => {
      const issued = await issueSession(userId, meta, "ghl");
      await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
      await writeAudit({
        actorId: userId,
        action: "auth.ghl_login.succeeded",
        entity: "User",
        entityId: userId,
        after: { role: scope },
        ...meta,
      });
      const response = NextResponse.redirect(new URL(home, request.url));
      setAuthCookies(response.cookies, issued, scope);
      return response;
    };

    // An unrendered merge field ("{{user.id}}") or anything that is not a GHL id.
    if (!/^[A-Za-z0-9]{10,64}$/.test(linkId)) return fail("ghl_link_invalid");

    /* ---------------------------------------------------------- admin */
    if (role === "admin") {
      const credential = await prisma.integrationCredential.findUnique({
        where: { provider: "gohighlevel" },
        select: { locationId: true, setupCompletedAt: true, connectedById: true },
      });
      if (!credential?.locationId || !credential.setupCompletedAt) return fail("ghl_not_connected");
      if (credential.locationId !== linkId) return fail("ghl_location_mismatch");

      const admins = await prisma.user.findMany({
        where: { status: "ACTIVE", deletedAt: null, roles: { some: { role: { key: "admin" } } } },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      const admin = admins.find((a) => a.id === credential.connectedById) ?? admins[0];
      if (!admin) return fail("ghl_no_admin");
      return signIn(admin.id, "admin", "/admin");
    }

    /* ------------------------------------------------ CSR / Sales Rep */
    const target = LINK_ROLES[role];
    if (!target) return fail("ghl_link_invalid");

    const expectedKey = process.env.GHL_AUTOLOGIN_KEY;
    if (expectedKey && !sameSecret(request.nextUrl.searchParams.get("key"), expectedKey)) {
      return fail("ghl_link_key");
    }

    const connection = await getGhlConnection();
    if (!connection) return fail("ghl_not_connected");

    let ghlUser;
    try {
      ghlUser = await getGhlUser(connection, linkId);
    } catch {
      return fail("ghl_unreachable");
    }
    if (!ghlUser || !isLocationUser(ghlUser, connection.locationId)) {
      return fail("ghl_user_invalid");
    }

    const user = await prisma.user.findUnique({
      where: { ghlUserId: linkId },
      include: { roles: { include: { role: true } } },
    });
    if (!user || user.deletedAt) return fail("ghl_user_not_in_app");
    if (user.status !== "ACTIVE") return fail("account_inactive");
    if (!user.roles.some((ur) => ur.role.key === target.roleKey)) {
      return fail("ghl_wrong_role", { appRole: user.role });
    }

    return signIn(user.id, target.scope, target.home);
  },
);
