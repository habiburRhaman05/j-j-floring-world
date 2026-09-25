import "server-only";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "./tokens";
import type { Role, User } from "@prisma/client";

/* ==========================================================================
   session.server.ts  -  access sessions + rotating refresh tokens
   --------------------------------------------------------------------------
   Two cookies, both httpOnly, both opaque (only their SHA-256 hash is stored):

     jjf_session   access token, 30 minutes. Maps to a `Session` row, which is
                   what every route handler and layout checks. Short-lived so
                   a suspended user loses access within minutes.

     jjf_refresh   refresh token, 30 days, sliding (90 day hard cap per
                   login). Used only to mint a new access + refresh pair, and
                   rotated on every use: the old token is marked used, a
                   successor is issued in the same "family". Presenting a used
                   token again after a short grace window means it was copied,
                   so the whole family (every session from that login) is
                   revoked.

   Manual login and GHL auto-login both call `issueSession`, so there is one
   session system with one set of rules. Refresh happens in three places:
   proxy.ts (page navigation), /api/auth/refresh (the axios client's 401
   retry) and /api/auth/session (first paint of the session provider).
   ========================================================================== */

import { REFRESH_COOKIE, SESSION_COOKIE } from "./cookie-names";

export { REFRESH_COOKIE, SESSION_COOKIE };

const ACCESS_TTL_MS = 30 * 60 * 1000;
/** The DB row outlives the cookie slightly, so clock skew never 401s a live cookie. */
const ACCESS_ROW_GRACE_MS = 2 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_ABSOLUTE_MS = 90 * 24 * 60 * 60 * 1000;
/** Two tabs refreshing at the same moment both present the same token; tolerate that. */
const REUSE_GRACE_MS = 30 * 1000;

export type AuthMethod = "password" | "ghl";

export interface CurrentSession {
  sessionId: string;
  familyId: string | null;
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

/* ---------------------------------------------------------------- cookies */

/**
 * Inside a GHL custom-menu iframe the app is a third-party context, and
 * browsers only keep cookies there when they are SameSite=None + Secure (plus
 * Partitioned, for Chrome's third-party-cookie rules). That applies in
 * development too, or auto-login works on the server and then lands on the
 * login form because the iframe dropped the cookie. Browsers treat
 * http://localhost as a secure origin, so Secure cookies still work locally;
 * a dev server reached by LAN IP over plain http would need HTTPS.
 */
const COOKIE_SECURITY = { secure: true, sameSite: "none", partitioned: true } as const;

/** Anything with a Next `cookies`-style setter: `await cookies()` or `response.cookies`. */
interface CookieWriter {
  set(name: string, value: string, options: Record<string, unknown>): unknown;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export function setAuthCookies(target: CookieWriter, issued: IssuedSession): void {
  target.set(SESSION_COOKIE, issued.accessToken, {
    httpOnly: true,
    path: "/",
    maxAge: Math.floor(ACCESS_TTL_MS / 1000),
    ...COOKIE_SECURITY,
  });
  target.set(REFRESH_COOKIE, issued.refreshToken, {
    httpOnly: true,
    path: "/",
    maxAge: Math.floor(REFRESH_TTL_MS / 1000),
    ...COOKIE_SECURITY,
  });
}

export function clearAuthCookies(target: CookieWriter): void {
  for (const name of [SESSION_COOKIE, REFRESH_COOKIE]) {
    target.set(name, "", { httpOnly: true, path: "/", maxAge: 0, ...COOKIE_SECURITY });
  }
}

/* ---------------------------------------------------------------- issuing */

interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * A new access session plus a refresh token. With no `family` this is a
 * fresh login (new family); with one it is a rotation inside that family.
 */
export async function issueSession(
  userId: string,
  meta: RequestMeta,
  method: AuthMethod,
  family?: { id: string; startedAt: Date },
): Promise<IssuedSession> {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const familyId = family?.id ?? randomUUID();
  const familyStartedAt = family?.startedAt ?? new Date();
  const now = Date.now();
  const refreshExpires = Math.min(now + REFRESH_TTL_MS, familyStartedAt.getTime() + REFRESH_ABSOLUTE_MS);

  await prisma.$transaction([
    prisma.session.create({
      data: {
        sessionToken: hashToken(accessToken),
        userId,
        familyId,
        authMethod: method,
        expires: new Date(now + ACCESS_TTL_MS + ACCESS_ROW_GRACE_MS),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        familyId,
        userId,
        familyStartedAt,
        authMethod: method,
        expiresAt: new Date(refreshExpires),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    }),
  ]);

  return { accessToken, refreshToken, userId };
}

/** Ends every session and refresh token that came from one login. */
export async function revokeFamily(familyId: string): Promise<void> {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { familyId } }),
  ]);
}

/** Signs a user out everywhere, optionally keeping the login they are using now. */
export async function revokeAllForUser(userId: string, exceptFamilyId?: string | null): Promise<void> {
  const keep = exceptFamilyId ? { NOT: { familyId: exceptFamilyId } } : {};
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, ...keep },
      data: { revokedAt: new Date() },
    }),
    prisma.session.deleteMany({
      where: exceptFamilyId
        ? { userId, OR: [{ familyId: null }, { familyId: { not: exceptFamilyId } }] }
        : { userId },
    }),
  ]);
}

export type RotateResult =
  | { ok: true; issued: IssuedSession }
  | { ok: false; reason: "missing" | "unknown" | "expired" | "revoked" | "reused" | "inactive" };

/**
 * Trades a refresh token for a new access + refresh pair. The used token is
 * claimed with a conditional update, so two requests racing on the same token
 * cannot both win the "first use" path.
 */
export async function rotateRefreshToken(raw: string | undefined, meta: RequestMeta): Promise<RotateResult> {
  if (!raw) return { ok: false, reason: "missing" };

  const token = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!token) return { ok: false, reason: "unknown" };
  if (token.revokedAt) return { ok: false, reason: "revoked" };

  const now = Date.now();
  if (now > token.expiresAt.getTime() || now > token.familyStartedAt.getTime() + REFRESH_ABSOLUTE_MS) {
    return { ok: false, reason: "expired" };
  }
  if (token.user.status !== "ACTIVE" || token.user.deletedAt) {
    await revokeFamily(token.familyId);
    return { ok: false, reason: "inactive" };
  }

  const claimed = await prisma.refreshToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date(now) },
  });

  if (claimed.count === 0) {
    // Already used. Moments ago means a parallel tab; any later means the
    // token was copied, and every session from that login is ended.
    const usedAt = (await prisma.refreshToken.findUnique({ where: { id: token.id } }))?.usedAt;
    if (!usedAt || now - usedAt.getTime() > REUSE_GRACE_MS) {
      await revokeFamily(token.familyId);
      await prisma.auditLog
        .create({
          data: {
            actorId: token.userId,
            action: "auth.refresh.reuse_detected",
            entity: "User",
            entityId: token.userId,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
          },
        })
        .catch(() => {});
      return { ok: false, reason: "reused" };
    }
  }

  const issued = await issueSession(
    token.userId,
    meta,
    token.authMethod === "ghl" ? "ghl" : "password",
    { id: token.familyId, startedAt: token.familyStartedAt },
  );
  return { ok: true, issued };
}

/* ----------------------------------------------------------------- reading */

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const rawAccess = store.get(SESSION_COOKIE)?.value;
  const rawRefresh = store.get(REFRESH_COOKIE)?.value;

  let familyId: string | null = null;
  if (rawAccess) {
    familyId =
      (await prisma.session.findUnique({ where: { sessionToken: hashToken(rawAccess) } }))?.familyId ?? null;
  }
  if (!familyId && rawRefresh) {
    familyId =
      (await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawRefresh) } }))?.familyId ?? null;
  }

  if (familyId) {
    await revokeFamily(familyId).catch(() => {});
  } else if (rawAccess) {
    await prisma.session.deleteMany({ where: { sessionToken: hashToken(rawAccess) } }).catch(() => {});
  }
  clearAuthCookies(store);
}

/**
 * Reads the access cookie and validates it against its Session row. Returns
 * null for anything invalid: no cookie, unknown token, expired, or a user who
 * is no longer ACTIVE. Never refreshes - see the header for where that happens.
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

  if (Date.now() > session.expires.getTime()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (session.user.status !== "ACTIVE" || session.user.deletedAt) {
    if (session.familyId) await revokeFamily(session.familyId).catch(() => {});
    else await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    sessionId: session.id,
    familyId: session.familyId,
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
  if (!session) {
    // The proxy normally refreshes before a page renders; this covers an
    // access cookie that expired between the proxy and this layout.
    const hasRefresh = (await cookies()).has(REFRESH_COOKIE);
    redirect(hasRefresh ? "/api/auth/refresh" : "/login");
  }

  if (allowedRoleKeys && allowedRoleKeys.length > 0) {
    const hasRole = session.roles.some((r) => allowedRoleKeys.includes(r.key));
    if (!hasRole) redirect(homeForRoles(session.roles));
  }

  return session;
}
