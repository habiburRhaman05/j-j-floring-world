import { NextResponse, type NextRequest } from "next/server";
import { SCOPE_HEADER, refreshCookieName, scopeForPath, sessionCookieName } from "@/lib/auth/cookie-names";

/* ==========================================================================
   proxy.ts  -  GHL auto-login links, session refresh, signed-out redirect
   --------------------------------------------------------------------------
   Renamed from `middleware.ts` in Next.js 16. Deliberately cookie-presence
   only - the real, database-backed check runs in each protected layout via
   `requireUser()`. Four jobs:

   1. /csr/{{user.id}}, /sales-rep/{{user.id}} and /admin/{{location.id}}
      (GHL custom menu links) are rewritten to the auto-login handler. A GHL
      id is 20-ish letters and digits with at least one capital or digit, so
      it can never collide with a real page segment like /csr/appointments.
   2. Each dashboard has its own session (cookie-names.ts). The page's
      dashboard is passed on as the x-jjf-scope header for requireUser().
   3. That dashboard's access cookie missing but its refresh cookie present:
      through /api/auth/refresh first, which rotates the pair and comes back.
   4. No cookies for that dashboard: off to /login.
   ========================================================================== */

/** Dashboards that accept a GHL auto-login link, keyed by URL prefix. */
const AUTO_LOGIN_PREFIXES = ["admin", "csr", "sales-rep"] as const;

/** Real page segments under those prefixes, excluded explicitly as a second guard. */
const RESERVED_SEGMENTS = new Set([
  "appointments",
  "calendar",
  "commission",
  "estimates",
  "jobs",
  "pipeline",
  "products",
  "team",
  "sync",
]);

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

  // Each dashboard has its own session (cookie-names.ts); this page belongs to one.
  const scope = scopeForPath(pathname);
  if (!scope) return NextResponse.next();

  if (request.cookies.has(sessionCookieName(scope))) {
    // Tell the layout (requireUser) which dashboard's cookies to read.
    const forwarded = new Headers(request.headers);
    forwarded.set(SCOPE_HEADER, scope);
    return NextResponse.next({ request: { headers: forwarded } });
  }

  if (request.cookies.has(refreshCookieName(scope))) {
    const refresh = new URL("/api/auth/refresh", request.url);
    refresh.searchParams.set("scope", scope);
    refresh.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(refresh);
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/sales-rep/:path*", "/csr/:path*", "/installer/:path*"],
};
