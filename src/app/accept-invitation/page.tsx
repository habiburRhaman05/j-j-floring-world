"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { apiGet, apiPost } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError, type ApiError } from "@/lib/api/errors";
import { formErrors } from "@/lib/api/form-errors";

function AcceptInvitationForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [invite, setInvite] = useState<{ email: string; roleName: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { fieldError, generalError } = formErrors(error);

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecking(false);
      return;
    }
    apiGet<{ email: string; roleName: string }>(
      `${endpoints.auth.acceptInvitation}?token=${encodeURIComponent(token)}`,
    )
      .then(setInvite)
      .catch((thrown) => setInviteError(toApiError(thrown).displayMessage))
      .finally(() => setChecking(false));
  }, [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiPost(endpoints.auth.acceptInvitation, { token, firstName, lastName, password });
      router.replace("/login");
    } catch (thrown) {
      setError(toApiError(thrown));
      setPending(false);
    }
  }

  if (checking) return null;
  if (!token || inviteError || !invite) {
    return (
      <p className="t-sub">
        {inviteError ?? "This invitation link is missing its token."} Ask your admin for a
        fresh link from Team → Pending invitations.
      </p>
    );
  }

  return (
    <>
      <p className="lede">
        You&apos;ve been invited as <strong>{invite.roleName}</strong>, signing in as{" "}
        <code>{invite.email}</code>.
      </p>
      <form className="login-form" onSubmit={onSubmit} noValidate>
        {generalError ? (
          <div className="login-alert" role="alert">
            {generalError}
          </div>
        ) : null}
        <div className="spread" style={{ gap: 12 }}>
          <Field label="First name" style={{ flex: 1 }}>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoFocus
              aria-invalid={fieldError("firstName") ? true : undefined}
            />
            {fieldError("firstName") ? <span className="field-err">{fieldError("firstName")}</span> : null}
          </Field>
          <Field label="Last name" style={{ flex: 1 }}>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              aria-invalid={fieldError("lastName") ? true : undefined}
            />
            {fieldError("lastName") ? <span className="field-err">{fieldError("lastName")}</span> : null}
          </Field>
        </div>
        <Field label="Choose a password">
          <Input
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={password}
            required
            aria-invalid={fieldError("password") ? true : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fieldError("password") ? <span className="field-err">{fieldError("password")}</span> : null}
        </Field>
        <Button type="submit" variant="primary" size="lg" block disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </>
  );
}

export default function AcceptInvitationPage() {
  return (
    <div className="login-page">
      <main className="login-main login-narrow">
        <div className="login-card">
          <div className="login-eyebrow t-eyebrow">Accept invitation</div>
          <h1>Set up your account</h1>

          <Suspense fallback={null}>
            <AcceptInvitationForm />
          </Suspense>

          <div className="login-foot">
            <Link href="/login" className="t-meta">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
