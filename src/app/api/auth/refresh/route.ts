import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api/api-route";
import { requestMeta } from "@/lib/auth/audit";
import { errorResponse } from "@/lib/api/server-response";
import { serializeSessionUser } from "@/lib/auth/serialize";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  homeForRoles,
  rotateRefreshToken,
  setAuthCookies,
} from "@/lib/auth/session.server";

/* ==========================================================================
   /api/auth/refresh  -  trade the refresh cookie for a new session pair
   --------------------------------------------------------------------------
   POST: the axios client calls this after a 401 and retries the request.
   GET:  the proxy (and requireUser) send a page navigation here when the
         access cookie has expired; it rotates and bounces straight back.
   ========================================================================== */

/** Only same-site paths, so `next` can never send someone to another origin. */
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/api/auth/refresh")) return null;
  return value;
}

export const POST = apiRoute(async (request: NextRequest) => {
  const store = await cookies();
  const result = await rotateRefreshToken(store.get(REFRESH_COOKIE)?.value, requestMeta(request));
  if (!result.ok) {
    clearAuthCookies(store);
    return errorResponse(401, "Your session has expired. Please sign in again.", {
      code: "session_expired",
    });
  }

  setAuthCookies(store, result.issued);
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
  const result = await rotateRefreshToken(
    request.cookies.get(REFRESH_COOKIE)?.value,
    requestMeta(request),
  );

  if (!result.ok) {
    const login = new URL("/login", request.url);
    if (next) login.searchParams.set("from", next);
    const response = NextResponse.redirect(login);
    clearAuthCookies(response.cookies);
    return response;
  }

  let destination = next;
  if (!destination) {
    const user = await prisma.user.findUnique({
      where: { id: result.issued.userId },
      include: { roles: { include: { role: true } } },
    });
    destination = user ? homeForRoles(user.roles.map((ur) => ur.role)) : "/login";
  }

  const response = NextResponse.redirect(new URL(destination, request.url));
  setAuthCookies(response.cookies, result.issued);
  return response;
});
