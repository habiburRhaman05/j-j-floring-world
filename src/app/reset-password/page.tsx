"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { apiPost } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError, type ApiError } from "@/lib/api/errors";
import { formErrors } from "@/lib/api/form-errors";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { fieldError, generalError } = formErrors(error);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiPost(endpoints.auth.resetPassword, { token, password });
      router.replace("/login");
    } catch (thrown) {
      setError(toApiError(thrown));
      setPending(false);
    }
  }

  if (!token) {
    return (
      <p className="t-sub">
        This reset link is missing its token.{" "}
        <Link href="/forgot-password">Request a new one</Link>.
      </p>
    );
  }

  return (
    <form className="login-form" onSubmit={onSubmit} noValidate>
      {generalError ? (
        <div className="login-alert" role="alert">
          {generalError}
        </div>
      ) : null}
      <Field label="New password">
        <Input
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={password}
          autoFocus
          required
          aria-invalid={fieldError("password") ? true : undefined}
          onChange={(e) => setPassword(e.target.value)}
        />
        {fieldError("password") ? <span className="field-err">{fieldError("password")}</span> : null}
      </Field>
      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="login-page">
      <main className="login-main login-narrow">
        <div className="login-card">
          <div className="login-eyebrow t-eyebrow">Reset password</div>
          <h1>Set a new password</h1>
          <p className="lede">At least 12 characters.</p>

          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>

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
