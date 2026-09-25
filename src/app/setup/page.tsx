"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { CheckField } from "@/components/ui/checkbox";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import {
  Table,
  TableWrap,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui/table";
import { apiGet, apiPost } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError, type ApiError } from "@/lib/api/errors";
import { formErrors } from "@/lib/api/form-errors";
import type {
  AppRoleKey,
  SetupCompleteResponse,
  SetupGhlUser,
  SetupStatusResponse,
  SetupVerifyResponse,
} from "@/lib/setup/types";

/* ==========================================================================
   /setup  -  first-run: connect GHL, choose who gets which app role
   --------------------------------------------------------------------------
   1. connect   SETUP_KEY + PIT token + Location ID, verified against GHL
   2. roles     every sub-account user, with a GHL role and an app role picker
   3. done      the temporary passwords, shown once, with "Copy all"
   ========================================================================== */

const ROLE_LABEL: Record<AppRoleKey, string> = {
  admin: "Admin",
  csr: "CSR",
  sales_rep: "Sales Rep",
  installer: "Installer",
};

const STAFF_ROLES: AppRoleKey[] = ["csr", "sales_rep", "installer"];

function ghlRoleLabel(ghlRole: string): string {
  const [type, role] = ghlRole.split(":");
  const level =
    type === "agency" ? "Agency" : type === "account" ? "Sub-account" : "GHL";
  return `${level} ${role === "admin" ? "admin" : role === "user" ? "user" : (role ?? "")}`.trim();
}

const OWNER_HOW: Record<string, string> = {
  company_email: "matched the agency's company email",
  location_email: "matched the business email on this sub-account",
  only_agency_admin: "the only agency admin",
};

export default function SetupPage() {
  const { toast } = useToast();

  const [status, setStatus] = useState<SetupStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<ApiError | null>(null);

  const [setupKey, setSetupKey] = useState("");
  const [token, setToken] = useState("");
  const [locationId, setLocationId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<ApiError | null>(null);
  const [verified, setVerified] = useState<SetupVerifyResponse | null>(null);

  const [roles, setRoles] = useState<Record<string, AppRoleKey | "">>({});
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<SetupCompleteResponse | null>(null);

  useEffect(() => {
    apiGet<SetupStatusResponse>(endpoints.setup.status)
      .then(setStatus)
      .catch((error) => setStatusError(toApiError(error)));
  }, []);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setVerifying(true);
    setVerifyError(null);
    try {
      const data = await apiPost<SetupVerifyResponse>(endpoints.setup.verify, {
        setupKey,
        token,
        locationId,
      });
      setVerified(data);
      // The agency owner is the Admin; everyone else waits for a staff role.
      setRoles(
        Object.fromEntries(
          data.users.map((u) => [
            u.ghlUserId,
            u.ghlUserId === data.ownerGhlUserId ? "admin" : "",
          ]),
        ),
      );
    } catch (error) {
      setVerifyError(toApiError(error));
    } finally {
      setVerifying(false);
    }
  }

  const assignments = Object.entries(roles)
    .filter((entry): entry is [string, AppRoleKey] => Boolean(entry[1]))
    .map(([ghlUserId, role]) => ({ ghlUserId, role }));
  const hasAdmin = assignments.some((a) => a.role === "admin");

  async function complete() {
    setCompleting(true);
    setCompleteError(null);
    try {
      const data = await apiPost<SetupCompleteResponse>(
        endpoints.setup.complete,
        {
          setupKey,
          token,
          locationId,
          assignments,
        },
      );
      setResult(data);
      // The token is saved server-side now; drop the browser's copy.
      setToken("");
    } catch (error) {
      setCompleteError(toApiError(error));
    } finally {
      setCompleting(false);
    }
  }

  function copyAll() {
    if (!result) return;
    const lines = [
      `${result.location.name} - app sign-in details`,
      `Sign in at: ${result.loginUrl}`,
      "Each person must change their password after first sign-in.",
      "",
      ...result.created.map(
        (u) =>
          `${u.name} | ${ROLE_LABEL[u.role]} | ${u.email} | temporary password: ${u.temporaryPassword}`,
      ),
    ];
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => toast("Copied every sign-in to the clipboard.", "ok"))
      .catch(() =>
        toast("Copy failed. Select the table and copy it by hand.", "warn"),
      );
  }

  const verifyErrors = formErrors(verifyError);

  return (
    <div className="login-page">
      <main className="login-main" style={{ maxWidth: 920 }}>
        <div className="login-card">
          <div className="login-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/jj-logo.png" alt="J&J Flooring World" />
          </div>
          <div className="login-eyebrow t-eyebrow" style={{ marginTop: 18 }}>
            First-run setup
          </div>

          {statusError ? (
            <div className="login-alert" role="alert">
              {statusError.displayMessage}
            </div>
          ) : !status ? (
            <p className="lede">Checking setup status…</p>
          ) : status.completed && !result ? (
            <>
              <h1>Setup is already complete</h1>
              <p className="lede">
                This app is connected to GoHighLevel and its users have been
                created. Admins manage users and roles from the Team page.
              </p>
              <Button asChild variant="primary">
                <Link href="/login">Go to sign in</Link>
              </Button>
            </>
          ) : !status.keyConfigured ? (
            <>
              <h1>Setup key missing</h1>
              <p className="lede">
                Add <code>SETUP_KEY</code> to the server&apos;s{" "}
                <code>.env</code> and restart it. The key is asked for on this
                page so nobody else can run setup.
              </p>
            </>
          ) : result ? (
            <SetupDone result={result} onCopyAll={copyAll} />
          ) : !verified ? (
            <>
              <h1>Connect GoHighLevel</h1>
              <p className="lede">
                Use a Private Integration token from the sub-account (Settings,
                Private Integrations) with the locations, users, contacts and
                opportunities scopes. The token is checked here and only saved
                when you complete setup.
              </p>
              <form className="login-form" onSubmit={verify} noValidate>
                {verifyErrors.generalError ? (
                  <div className="login-alert" role="alert">
                    {verifyErrors.generalError}
                  </div>
                ) : null}
                <Field label="Setup key (SETUP_KEY in .env)">
                  <Input
                    type="password"
                    autoComplete="off"
                    value={setupKey}
                    onChange={(event) => setSetupKey(event.target.value)}
                  />
                  {verifyErrors.fieldError("setupKey") ? (
                    <span className="field-err">
                      {verifyErrors.fieldError("setupKey")}
                    </span>
                  ) : null}
                </Field>
                <Field label="GHL Private Integration token">
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder="pit-..."
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                  />
                  {verifyErrors.fieldError("token") ? (
                    <span className="field-err">
                      {verifyErrors.fieldError("token")}
                    </span>
                  ) : null}
                </Field>
                <Field label="GHL Location ID (sub-account)">
                  <Input
                    autoComplete="off"
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                  />
                  {verifyErrors.fieldError("locationId") ? (
                    <span className="field-err">
                      {verifyErrors.fieldError("locationId")}
                    </span>
                  ) : null}
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  block
                  loading={verifying}
                >
                  {verifying
                    ? "Checking with GoHighLevel…"
                    : "Verify and load users"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1>Choose app roles</h1>
              <p className="lede">
                Connected to <strong>{verified.location.name}</strong>. The
                agency owner is the app Admin. Give every other user who should
                use this app a staff role (CSR, Sales Rep or Installer); leave
                the rest as &quot;Don&apos;t add&quot;.
              </p>
              {verified.ownerGhlUserId ? (
                <p className="t-meta" style={{ margin: "-10px 0 14px" }}>
                  Agency owner found:{" "}
                  <strong>
                    {
                      verified.users.find(
                        (u) => u.ghlUserId === verified.ownerGhlUserId,
                      )?.name
                    }
                  </strong>{" "}
                  ({OWNER_HOW[verified.ownerDetectedBy ?? ""] ?? "detected"}).
                </p>
              ) : (
                <div
                  className="login-alert"
                  role="note"
                  style={{ marginBottom: 14 }}
                >
                  <span>
                    The agency owner could not be identified from GoHighLevel,
                    so pick who should be the Admin below.
                  </span>
                </div>
              )}

              {verified.users.length === 0 ? (
                <div className="login-alert" role="alert">
                  GoHighLevel returned no sub-account users for this location.
                </div>
              ) : (
                <TableWrap>
                  <Table>
                    <THead>
                      <Tr>
                        <Th>Name</Th>
                        <Th>Email</Th>
                        <Th>GHL role</Th>
                        <Th>App role</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {verified.users.map((user: SetupGhlUser) => {
                        const isOwner =
                          user.ghlUserId === verified.ownerGhlUserId;
                        const choices = isOwner
                          ? (["admin"] as AppRoleKey[])
                          : verified.ownerGhlUserId
                            ? STAFF_ROLES
                            : (Object.keys(ROLE_LABEL) as AppRoleKey[]);
                        return (
                          <Tr key={user.ghlUserId}>
                            <Td>
                              {user.name}{" "}
                              {isOwner ? (
                                <Pill
                                  className="pill-blue"
                                  title="Agency owner"
                                >
                                  Agency owner
                                </Pill>
                              ) : null}
                            </Td>
                            <Td>
                              {user.email || (
                                <span className="field-err">No email</span>
                              )}
                            </Td>
                            <Td>
                              <Pill
                                className={
                                  user.ghlRole.startsWith("agency:")
                                    ? "pill-oak"
                                    : "pill-outline"
                                }
                              >
                                {ghlRoleLabel(user.ghlRole)}
                              </Pill>
                            </Td>
                            <Td>
                              <Select
                                aria-label={`App role for ${user.name}`}
                                value={roles[user.ghlUserId] ?? ""}
                                disabled={!user.email || isOwner}
                                onChange={(event) =>
                                  setRoles((prev) => ({
                                    ...prev,
                                    [user.ghlUserId]: event.target.value as
                                      AppRoleKey | "",
                                  }))
                                }
                              >
                                {isOwner ? null : (
                                  <option value="">Don&apos;t add</option>
                                )}
                                {choices.map((key) => (
                                  <option key={key} value={key}>
                                    {ROLE_LABEL[key]}
                                  </option>
                                ))}
                              </Select>
                            </Td>
                          </Tr>
                        );
                      })}
                    </TBody>
                  </Table>
                </TableWrap>
              )}

              <div
                className="login-alert"
                role="note"
                style={{ marginTop: 16 }}
              >
                <span>
                  Completing setup{" "}
                  <strong>deletes every existing user of this app</strong> (a
                  backup is written to the server&apos;s <code>backups/</code>{" "}
                  folder first) and creates the {assignments.length} selected
                  user
                  {assignments.length === 1 ? "" : "s"}, each with a temporary
                  password. Setup cannot be run again afterwards.
                </span>
              </div>

              <div style={{ margin: "12px 0" }}>
                <CheckField
                  checked={confirmWipe}
                  onCheckedChange={setConfirmWipe}
                >
                  I understand existing users will be deleted.
                </CheckField>
              </div>

              {completeError ? (
                <div className="login-alert" role="alert">
                  {completeError.displayMessage}
                </div>
              ) : null}

              <div
                className="row"
                style={{ justifyContent: "space-between", marginTop: 12 }}
              >
                <Button
                  variant="ghost"
                  disabled={completing}
                  onClick={() => setVerified(null)}
                >
                  Back
                </Button>
                <div className="row">
                  {!hasAdmin ? (
                    <span className="t-meta">Pick at least one Admin.</span>
                  ) : null}
                  <Button
                    variant="primary"
                    loading={completing}
                    disabled={!hasAdmin || !confirmWipe}
                    onClick={() => void complete()}
                  >
                    {completing ? "Creating users…" : "Complete setup"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SetupDone({
  result,
  onCopyAll,
}: {
  result: SetupCompleteResponse;
  onCopyAll: () => void;
}) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <>
      <h1>Setup complete</h1>
      <p className="lede">
        {result.created.length} user{result.created.length === 1 ? "" : "s"}{" "}
        created for <strong>{result.location.name}</strong>. Copy these
        temporary passwords now:{" "}
        <strong>they are not stored and will not be shown again.</strong>{" "}
        Everyone is asked to set their own password after their first sign-in.
      </p>

      <TableWrap>
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>Email (sign-in)</Th>
              <Th>App role</Th>
              <Th>Temporary password</Th>
            </Tr>
          </THead>
          <TBody>
            {result.created.map((user) => (
              <Tr key={user.ghlUserId}>
                <Td>{user.name}</Td>
                <Td>{user.email}</Td>
                <Td>
                  <Pill className="pill-outline">{ROLE_LABEL[user.role]}</Pill>
                </Td>
                <Td>
                  <code style={{ fontSize: 14, userSelect: "all" }}>
                    {user.temporaryPassword}
                  </code>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableWrap>

      <div className="row" style={{ marginTop: 16, flexWrap: "wrap" }}>
        <Button variant="primary" onClick={onCopyAll}>
          Copy all sign-in details
        </Button>
        <Button asChild>
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>

      <div style={{ marginTop: 22 }}>
        <div className="label">GHL custom menu links (auto-login)</div>
        <ul
          className="t-meta"
          style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.8 }}
        >
          <li>
            CSR:{" "}
            <code>
              {origin}/csr/{"{{user.id}}"}?key=GHL_AUTOLOGIN_KEY
            </code>
          </li>
          <li>
            Sales Rep:{" "}
            <code>
              {origin}/sales-rep/{"{{user.id}}"}?key=GHL_AUTOLOGIN_KEY
            </code>
          </li>
        </ul>
        <div className="t-meta" style={{ marginTop: 6 }}>
          Replace <code>GHL_AUTOLOGIN_KEY</code> with the value from the
          server&apos;s .env. Admins and installers sign in with email and
          password.
        </div>
      </div>
    </>
  );
}
