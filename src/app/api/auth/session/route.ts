import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api/api-route";
import { requestMeta } from "@/lib/auth/audit";
import { serializeSessionUser } from "@/lib/auth/serialize";
import { refreshCookieName, SESSION_SCOPES } from "@/lib/auth/cookie-names";
import {
  clearAuthCookies,
  getCurrentSession,
  requestScope,
  rotateRefreshToken,
  setAuthCookies,
} from "@/lib/auth/session.server";

/**
 * Powers the session provider's first paint, for the dashboard the page is on
 * (x-jjf-scope). An expired access cookie with a live refresh cookie is
 * refreshed right here, so opening the app after a break never shows the
 * signed-out state for a moment.
 */
export const GET = apiRoute(async (request: NextRequest) => {
  const session = await getCurrentSession();
  if (session) {
    return NextResponse.json({ user: serializeSessionUser(session.user, session.roles) });
  }

  const store = await cookies();
  const named = await requestScope();
  for (const scope of named ? [named] : SESSION_SCOPES) {
    const raw = store.get(refreshCookieName(scope))?.value;
    if (!raw) continue;

    const result = await rotateRefreshToken(raw, requestMeta(request));
    if (!result.ok) {
      clearAuthCookies(store, scope);
      continue;
    }

    setAuthCookies(store, result.issued, scope);
    const user = await prisma.user.findUnique({
      where: { id: result.issued.userId },
      include: { roles: { include: { role: true } } },
    });
    return NextResponse.json({
      user: user ? serializeSessionUser(user, user.roles.map((ur) => ur.role)) : null,
    });
  }
  return NextResponse.json({ user: null });
});
