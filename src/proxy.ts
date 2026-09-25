import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/auth/cookie-names";

/* ==========================================================================
   proxy.ts  -  GHL auto-login links, session refresh, signed-out redirect
   --------------------------------------------------------------------------
   Renamed from `middleware.ts` in Next.js 16. Deliberately cookie-presence
   only - the real, database-backed check runs in each protected layout via
   `requireUser()`. Three jobs:

   1. /csr/{{user.id}} and /sales-rep/{{user.id}} (GHL custom menu links) are
      rewritten to the auto-login handler. A GHL id is 20-ish letters and
      digits with at least one capital or digit, so it can never collide with
      a real page segment like /csr/appointments.
   2. A protected page with no access cookie but a refresh cookie goes through
      /api/auth/refresh first, which rotates the pair and comes straight back.
   3. No cookies at all: off to /login.
   ========================================================================== */

const PROTECTED_PREFIXES = ["/admin", "/sales-rep", "/csr", "/installer", "/account"];

/** Dashboards that accept a GHL auto-login link, keyed by URL prefix. */
const AUTO_LOGIN_PREFIXES = ["csr", "sales-rep"] as const;

/** Real page segments under those prefixes, excluded explicitly as a second guard. */
const RESERVED_SEGMENTS = new Set(["appointments", "calendar", "commission", "estimates", "jobs", "pipeline"]);

function isGhlId(segment: string): boolean {
  return (
    /^[A-Za-z0-9]{10,64}$/.test(segment) &&
    /[A-Z0-9]/.test(segment) &&
    !RESERVED_SEGMENTS.has(segment.toLowerCase())
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const parts = pathname.split("/").filter(Boolean);
  if (
    parts.length === 2 &&
    (AUTO_LOGIN_PREFIXES as readonly string[]).includes(parts[0]!) &&
    isGhlId(parts[1]!)
  ) {
    // A page with a spinner first, which then calls the auto-login handler,
    // so the person sees "Signing you in" rather than a blank frame.
    const signIn = new URL("/auth/ghl", request.url);
    signIn.searchParams.set("role", parts[0]!);
    signIn.searchParams.set("id", parts[1]!);
    const key = request.nextUrl.searchParams.get("key");
    if (key) signIn.searchParams.set("key", key);
    return NextResponse.rewrite(signIn);
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  if (request.cookies.has(REFRESH_COOKIE)) {
    const refresh = new URL("/api/auth/refresh", request.url);
    refresh.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(refresh);
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/sales-rep/:path*", "/csr/:path*", "/installer/:path*", "/account/:path*"],
};
