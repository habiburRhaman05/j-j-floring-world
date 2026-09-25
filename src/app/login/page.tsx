"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { apiGet } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError, type ApiError } from "@/lib/api/errors";
import type { SetupStatusResponse } from "@/lib/setup/types";
import { ROLE_HOME } from "@/lib/auth/auth-service";

/** Why a GHL custom-menu auto-login bounced here (see /api/auth/ghl/...). */
const AUTO_LOGIN_ERRORS: Record<string, string> = {
  ghl_link_invalid: "That GoHighLevel link is not set up correctly. Ask an admin to check the custom menu link.",
  ghl_link_key: "That GoHighLevel link is missing its key or the key is wrong. Ask an admin to check the custom menu link.",
  ghl_not_connected: "The app is not connected to GoHighLevel yet. An admin needs to finish setup.",
  ghl_unreachable: "GoHighLevel could not be reached to confirm who you are. Try again, or sign in below.",
  ghl_user_invalid: "GoHighLevel does not recognise that user for this business.",
  ghl_user_not_in_app: "Your GoHighLevel user has not been given access to this app. Ask an admin.",
  ghl_wrong_role: "Your account has a different role in this app, so that link cannot open this dashboard. Sign in below.",
  account_inactive: "Your account is not active. Contact an administrator.",
};

/**
 * The one sign-in for the whole app. No role picker: the role is a property
 * of the account, so the credentials decide which workspace opens.
 */
export default function LoginPage() {
  // useSearchParams (the auto-login error) needs a Suspense boundary to prerender.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { session, loading, signIn } = useSession();
  const { toast } = useToast();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const autoLoginError = AUTO_LOGIN_ERRORS[useSearchParams().get("error") ?? ""] ?? null;

  useEffect(() => {
    apiGet<SetupStatusResponse>(endpoints.setup.status)
      .then((status) => setSetupOpen(!status.completed))
      .catch(() => setSetupOpen(false));
  }, []);

  // Already signed in? Go straight to your workspace.
  useEffect(() => {
    if (!loading && session) router.replace(ROLE_HOME[session.role]);
  }, [loading, session, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const next = await signIn(email, password);
      toast(`Signed in as ${next.email}.`, "ok");
      if (next.mustChangePassword) {
        toast("Set a new password from the Account menu when you have a moment.", "warn");
      }
      router.replace(ROLE_HOME[next.role]);
    } catch (thrown) {
      setError(toApiError(thrown));
      setPending(false);
    }
  }

  /** A message the server attached to one specific input. */
  const fieldError = (field: string) =>
    error?.fields.find((f) => f.field === field)?.message ?? null;

  const generalError = error && error.fields.length === 0 ? error.displayMessage : null;
  const emailError = fieldError("email");
  const passwordError = fieldError("password");

  return (
    <div className="login-page">
      <main className="login-main login-narrow">
        <div className="login-card">
          <div className="login-brand">
            <Link href="/login" aria-label="J&J Flooring World">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/jj-logo.png" alt="J&J Flooring World" />
            </Link>
          </div>
          <div className="login-tag">Love Where You Walk</div>

          <div className="login-eyebrow t-eyebrow">Team sign in</div>
          <h1>Sign in to your workspace</h1>
          <p className="lede">
            One sign-in for the whole team. Your account decides what opens: Admin,
            Sales Rep, CSR or Installer.
          </p>

          <form className="login-form" onSubmit={onSubmit} noValidate>
            {generalError || autoLoginError ? (
              <div className="login-alert" role="alert">
                {generalError ?? autoLoginError}
              </div>
            ) : null}

            <Field label="Email">
              <Input
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                placeholder="you@jjflooringworld.com"
                value={email}
                autoFocus
                required
                aria-invalid={emailError ? true : undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
              {emailError ? <span className="field-err">{emailError}</span> : null}
            </Field>

            <Field label="Password">
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                required
                aria-invalid={passwordError ? true : undefined}
                onChange={(event) => setPassword(event.target.value)}
              />
              {passwordError ? <span className="field-err">{passwordError}</span> : null}
            </Field>

            <Button type="submit" variant="primary" size="lg" block loading={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="login-foot">
            <Link href="/forgot-password" className="t-meta">
              Forgot your password?
            </Link>
            {setupOpen ? (
              <Link href="/setup" className="t-meta" style={{ marginLeft: 16 }}>
                First time here? Run setup
              </Link>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
