import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "./tokens";
import type { Role, User } from "@prisma/client";

/* ==========================================================================
   session.server.ts  -  database-backed sessions (doc 04 §7)
   --------------------------------------------------------------------------
   Database sessions, not JWT, so a suspended user loses access on their very
   next request rather than whenever a token happens to expire. The cookie
   itself is a long-lived (30 day) opaque bearer; the *real* expiry - the
   rolling 12h idle window and the 30 day absolute cap - lives on the
   `Session` row and is enforced here on every read, independent of what the
   cookie's own Max-Age says.
   ========================================================================== */

export const SESSION_COOKIE = "jjf_session";
const IDLE_MS = 12 * 60 * 60 * 1000;
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

export interface CurrentSession {
  sessionId: string;
  user: User;
  roles: Role[];
  activeRoleId: string | null;
}

/** Role keys this build's dashboards are gated on, and where each one lands. */
export const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  sales_rep: "/sales-rep",
  csr: "/csr",
  installer: "/installer",
};

export function homeForRoles(roles: Role[]): string {
  for (const key of Object.keys(ROLE_HOME)) {
    if (roles.some((r) => r.key === key)) return ROLE_HOME[key]!;
  }
  return "/login";
}

/**
 * Creates a Session row and returns the raw token to put in the cookie.
 * Caller (a route handler) is responsible for setting the cookie itself,
 * since only route handlers and server actions may do that.
 */
export async function createSession(
  userId: string,
  meta: { ipAddress: string | null; userAgent: string | null },
): Promise<{ token: string; expires: Date }> {
  const token = generateToken();
  const expires = new Date(Date.now() + IDLE_MS);
  await prisma.session.create({
    data: {
      sessionToken: hashToken(token),
      userId,
      expires,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
  return { token, expires };
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    await prisma.session.deleteMany({ where: { sessionToken: hashToken(raw) } }).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Reads the session cookie, validates and rolls the idle window forward.
 * Returns null for anything invalid: no cookie, unknown token, idle-expired,
 * past the absolute cap, or a user who is no longer ACTIVE.
 */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: hashToken(raw) },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });
  if (!session) return null;

  const now = Date.now();
  const absoluteDeadline = session.createdAt.getTime() + ABSOLUTE_MS;
  if (now > session.expires.getTime() || now > absoluteDeadline) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (session.user.status !== "ACTIVE" || session.user.deletedAt) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const newExpires = new Date(Math.min(now + IDLE_MS, absoluteDeadline));
  if (newExpires.getTime() - session.expires.getTime() > 5 * 60 * 1000) {
    await prisma.session.update({ where: { id: session.id }, data: { expires: newExpires } });
  }

  return {
    sessionId: session.id,
    user: session.user,
    roles: session.user.roles.map((ur) => ur.role),
    activeRoleId: session.activeRoleId,
  };
}

/**
 * The authoritative, server-side guard. Called at the top of every protected
 * layout and route handler (never rely on the proxy alone - see proxy.ts).
 * With no `allowedRoleKeys`, any authenticated user passes. Otherwise a user
 * without one of the listed roles is sent to their own home, not an error
 * page, so a stale bookmark or a shared link never looks like a dead end.
 */
export async function requireUser(allowedRoleKeys?: string[]): Promise<CurrentSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  if (allowedRoleKeys && allowedRoleKeys.length > 0) {
    const hasRole = session.roles.some((r) => allowedRoleKeys.includes(r.key));
    if (!hasRole) redirect(homeForRoles(session.roles));
  }

  return session;
}
