"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { apiPost } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError, type ApiError } from "@/lib/api/errors";
import { formErrors } from "@/lib/api/form-errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { fieldError, generalError } = formErrors(error);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiPost(endpoints.auth.forgotPassword, { email });
      setSent(true);
    } catch (thrown) {
      setError(toApiError(thrown));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="login-page">
      <main className="login-main login-narrow">
        <div className="login-card">
          <div className="login-eyebrow t-eyebrow">Reset password</div>
          <h1>Forgot your password?</h1>
          <p className="lede">Enter your sign-in email and we&apos;ll send a reset link.</p>

          {sent ? (
            <p className="t-sub">
              If that address is registered, a reset link has been sent. Check your inbox.
            </p>
          ) : (
            <form className="login-form" onSubmit={onSubmit} noValidate>
              {generalError ? (
                <div className="login-alert" role="alert">
                  {generalError}
                </div>
              ) : null}
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="username"
                  value={email}
                  autoFocus
                  required
                  aria-invalid={fieldError("email") ? true : undefined}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {fieldError("email") ? <span className="field-err">{fieldError("email")}</span> : null}
              </Field>
              <Button type="submit" variant="primary" size="lg" block disabled={pending}>
                {pending ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}

          <div className="login-foot">
            <Link href="/login" className="t-meta">
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
