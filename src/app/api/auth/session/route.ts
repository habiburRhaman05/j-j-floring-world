import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api/api-route";
import { requestMeta } from "@/lib/auth/audit";
import { serializeSessionUser } from "@/lib/auth/serialize";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  getCurrentSession,
  rotateRefreshToken,
  setAuthCookies,
} from "@/lib/auth/session.server";

/**
 * Powers the session provider's first paint. An expired access cookie with a
 * live refresh cookie is refreshed right here, so opening the app after a
 * break never shows the signed-out state for a moment.
 */
export const GET = apiRoute(async (request: NextRequest) => {
  const session = await getCurrentSession();
  if (session) {
    return NextResponse.json({ user: serializeSessionUser(session.user, session.roles) });
  }

  const store = await cookies();
  const raw = store.get(REFRESH_COOKIE)?.value;
  if (!raw) return NextResponse.json({ user: null });

  const result = await rotateRefreshToken(raw, requestMeta(request));
  if (!result.ok) {
    clearAuthCookies(store);
    return NextResponse.json({ user: null });
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
