import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api/api-route";
import { requestMeta } from "@/lib/auth/audit";
import { errorResponse } from "@/lib/api/server-response";
import { serializeSessionUser } from "@/lib/auth/serialize";
import { isSessionScope, refreshCookieName, scopeForPath } from "@/lib/auth/cookie-names";
import {
  clearAuthCookies,
  homeForRoles,
  refreshCookieScope,
  requestScope,
  rotateRefreshToken,
  setAuthCookies,
} from "@/lib/auth/session.server";

/* ==========================================================================
   /api/auth/refresh  -  trade a dashboard's refresh cookie for a new pair
   --------------------------------------------------------------------------
   POST: the axios client calls this after a 401 and retries the request; the
         dashboard comes from its x-jjf-scope header.
   GET:  the proxy (and requireUser) send a page navigation here when that
         dashboard's access cookie has expired; it rotates and bounces back.
         The dashboard comes from ?scope= or from the ?next= path.
   ========================================================================== */

/** Only same-site paths, so `next` can never send someone to another origin. */
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/api/auth/refresh")) return null;
  return value;
}

export const POST = apiRoute(async (request: NextRequest) => {
  const store = await cookies();
  const scope = await refreshCookieScope(await requestScope());
  if (!scope) {
    return errorResponse(401, "Your session has expired. Please sign in again.", { code: "session_expired" });
  }

  const result = await rotateRefreshToken(store.get(refreshCookieName(scope))?.value, requestMeta(request));
  if (!result.ok) {
    clearAuthCookies(store, scope);
    return errorResponse(401, "Your session has expired. Please sign in again.", {
      code: "session_expired",
    });
  }

  setAuthCookies(store, result.issued, scope);
  const user = await prisma.user.findUnique({
    where: { id: result.issued.userId },
    include: { roles: { include: { role: true } } },
  });
  return NextResponse.json({
    user: user ? serializeSessionUser(user, user.roles.map((ur) => ur.role)) : null,
  });
});

export const GET = apiRoute(async (request: NextRequest) => {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const named = request.nextUrl.searchParams.get("scope");
  const scope = isSessionScope(named) ? named : scopeForPath(next);
  const found = await refreshCookieScope(scope);

  const toLogin = () => {
    const login = new URL("/login", request.url);
    if (next) login.searchParams.set("from", next);
    const response = NextResponse.redirect(login);
    if (found) clearAuthCookies(response.cookies, found);
    return response;
  };
  if (!found) return toLogin();

  const result = await rotateRefreshToken(
    request.cookies.get(refreshCookieName(found))?.value,
    requestMeta(request),
  );
  if (!result.ok) return toLogin();

  let destination = next;
  if (!destination) {
    const user = await prisma.user.findUnique({
      where: { id: result.issued.userId },
      include: { roles: { include: { role: true } } },
    });
    destination = user ? homeForRoles(user.roles.map((ur) => ur.role)) : "/login";
  }

  const response = NextResponse.redirect(new URL(destination, request.url));
  setAuthCookies(response.cookies, result.issued, found);
  return response;
});
