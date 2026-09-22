import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session.server";

/* ==========================================================================
   proxy.ts  -  fast, cookie-presence-only redirect for protected sections
   --------------------------------------------------------------------------
   Renamed from `middleware.ts` in Next.js 16. This is NOT the authoritative
   check - it only saves a signed-out visitor a wasted render by redirecting
   before the page even starts. The real, database-backed check (does the
   session still exist, is the user ACTIVE, do they hold the right role) runs
   in each protected layout via `requireUser()` (src/lib/auth/session.server.ts).
   Next's own docs warn against relying on Proxy alone, since a routing
   refactor can silently remove its coverage - so this file is deliberately
   doing the minimum, not the whole job.
   ========================================================================== */

const PROTECTED_PREFIXES = ["/admin", "/sales-rep", "/csr", "/installer", "/account"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/sales-rep/:path*", "/csr/:path*", "/installer/:path*", "/account/:path*"],
};
