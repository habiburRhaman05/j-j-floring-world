"use client";

import { useEffect } from "react";

/** Dashboards that accept a GHL auto-login link, by first path segment. */
const LINK_ROLES = new Set(["admin", "csr", "sales-rep"]);

/**
 * Shown while a GHL custom-menu link signs someone in. proxy.ts rewrites
 * /csr/{{user.id}}, /sales-rep/{{user.id}} and /admin/{{location.id}} here; this page immediately
 * hands off to the auto-login handler, which checks the user with GHL and our
 * database, sets the session cookies and redirects to the dashboard (or to
 * /login with the reason when a check fails).
 *
 * The role and user id are read from the address bar, not from query
 * parameters: a rewrite does not change the URL the browser sees, so in the
 * browser this page only ever sees the original /csr/<id>?key=... address.
 */
export default function GhlSignInPage() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const [first, second] = url.pathname.split("/").filter(Boolean);
    // Normally /csr/<id>; the query form covers someone opening /auth/ghl directly.
    const role = first && LINK_ROLES.has(first) ? first : (url.searchParams.get("role") ?? "");
    const id = first && LINK_ROLES.has(first) ? (second ?? "") : (url.searchParams.get("id") ?? "");
    const key = url.searchParams.get("key");

    if (!role || !id) {
      window.location.replace("/login?error=ghl_link_invalid");
      return;
    }
    window.location.replace(
      `/api/auth/ghl/${encodeURIComponent(role)}/${encodeURIComponent(id)}${
        key ? `?key=${encodeURIComponent(key)}` : ""
      }`,
    );
  }, []);

  return (
    <div className="login-page">
      <main className="login-main login-narrow">
        <div className="login-card auto-login" role="status" aria-live="polite">
          <span className="auto-login-spinner" aria-hidden="true" />
          <h1>Signing you in…</h1>
          <p className="lede">Checking your GoHighLevel account. This takes a second.</p>
        </div>
      </main>
    </div>
  );
}
