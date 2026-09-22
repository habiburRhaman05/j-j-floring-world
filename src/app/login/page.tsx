"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toApiError, type ApiError } from "@/lib/api/errors";
import { ROLE_HOME } from "@/lib/auth/auth-service";

/**
 * The one sign-in for the whole app. No role picker: the role is a property
 * of the account, so the credentials decide which workspace opens.
 */
export default function LoginPage() {
  const { session, loading, signIn } = useSession();
  const { toast } = useToast();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

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
            {generalError ? (
              <div className="login-alert" role="alert">
                {generalError}
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

            <Button type="submit" variant="primary" size="lg" block disabled={pending}>
              {pending ? "Signing in" : "Sign in"}
            </Button>
          </form>

          <div className="login-foot">
            <Link href="/forgot-password" className="t-meta">
              Forgot your password?
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
