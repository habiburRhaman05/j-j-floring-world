"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Shown while a GHL custom-menu link signs someone in. proxy.ts rewrites
 * /csr/{{user.id}} and /sales-rep/{{user.id}} here; this page immediately
 * hands off to the auto-login handler, which checks the user with GHL and our
 * database, sets the session cookies and redirects to the dashboard (or to
 * /login with the reason when a check fails).
 */
export default function GhlSignInPage() {
  return (
    <Suspense fallback={<SigningIn />}>
      <HandOff />
    </Suspense>
  );
}

function HandOff() {
  const params = useSearchParams();

  useEffect(() => {
    const role = params.get("role") ?? "";
    const id = params.get("id") ?? "";
    const key = params.get("key");
    const target = `/api/auth/ghl/${encodeURIComponent(role)}/${encodeURIComponent(id)}${
      key ? `?key=${encodeURIComponent(key)}` : ""
    }`;
    window.location.replace(target);
  }, [params]);

  return <SigningIn />;
}

function SigningIn() {
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
