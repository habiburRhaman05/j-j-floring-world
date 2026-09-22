"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "@/components/providers/session-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Panel, PanelBody } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError, type ApiError } from "@/lib/api/errors";
import { formErrors } from "@/lib/api/form-errors";
import { roleLabel } from "@/lib/auth/roles";

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AccountProfile {
  firstName: string;
  lastName: string;
  phone: string | null;
  timezone: string;
  avatarUrl: string | null;
}

/** The signed-in account: profile, avatar, password, and the way out. */
export function AccountDialog({ open, onOpenChange }: AccountDialogProps) {
  const { session, signOut } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<ApiError | null>(null);
  const { fieldError: passwordFieldError, generalError: passwordGeneralError } = formErrors(passwordError);

  useEffect(() => {
    if (!open) return;
    apiGet<AccountProfile>(endpoints.account.get)
      .then((data) => {
        setProfile(data);
        setFirstName(data.firstName);
        setLastName(data.lastName);
        setPhone(data.phone ?? "");
      })
      .catch(() => {
        /* Header still shows session-derived name/email if this fails. */
      });
  }, [open]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await apiPatch(endpoints.account.update, { firstName, lastName, phone: phone || null });
      toast("Profile updated.", "ok");
    } catch (thrown) {
      toast(toApiError(thrown).displayMessage, "warn");
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // Let the browser/axios set the multipart Content-Type (with boundary)
      // itself - setting it manually here would omit the boundary and break
      // the upload.
      const result = await apiPost<{ avatarUrl: string }>(endpoints.account.avatar, form);
      setProfile((prev) => (prev ? { ...prev, avatarUrl: result.avatarUrl } : prev));
      toast("Photo updated.", "ok");
    } catch (thrown) {
      toast(toApiError(thrown).displayMessage, "warn");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setChangingPassword(true);
    setPasswordError(null);
    try {
      await apiPost(endpoints.account.password, { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      toast("Password updated. Your other sessions were signed out.", "ok");
    } catch (thrown) {
      setPasswordError(toApiError(thrown));
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Account"
      subtitle={session ? `${session.name}, ${roleLabel(session.role)}` : "Not signed in"}
      actions={[
        {
          label: "Sign out",
          variant: "danger",
          keep: true,
          onClick: async (close) => {
            await signOut();
            close();
            router.push("/login");
          },
        },
        { label: "Close", variant: "primary" },
      ]}
    >
      <Panel>
        <PanelBody tight>
          <div className="spread">
            <div>
              <div style={{ fontWeight: 600 }}>{session?.name ?? "Nobody"}</div>
              <div className="t-meta">{session?.email ?? ""}</div>
            </div>
            <Pill className="pill-outline">{session ? roleLabel(session.role) : "-"}</Pill>
          </div>
        </PanelBody>
      </Panel>

      <Panel style={{ marginTop: 16 }}>
        <PanelBody>
          <div className="spread" style={{ alignItems: "center", marginBottom: 12 }}>
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt=""
                style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <span className="bar-avatar" style={{ width: 48, height: 48 }} />
            )}
            <label className="t-meta" style={{ cursor: "pointer" }}>
              {uploadingAvatar ? "Uploading…" : "Change photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                disabled={uploadingAvatar}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          <form onSubmit={saveProfile}>
            <div className="spread" style={{ gap: 12 }}>
              <Field label="First name" style={{ flex: 1 }}>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </Field>
              <Field label="Last name" style={{ flex: 1 }}>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </Field>
            </div>
            <Field label="Phone">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Button type="submit" size="sm" disabled={savingProfile} style={{ marginTop: 8 }}>
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </PanelBody>
      </Panel>

      <Panel style={{ marginTop: 16 }}>
        <PanelBody>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Change password</div>
          <form onSubmit={changePassword} noValidate>
            {passwordGeneralError ? (
              <div className="login-alert" role="alert" style={{ marginBottom: 12 }}>
                {passwordGeneralError}
              </div>
            ) : null}
            <Field label="Current password">
              <Input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                aria-invalid={passwordFieldError("currentPassword") ? true : undefined}
              />
              {passwordFieldError("currentPassword") ? (
                <span className="field-err">{passwordFieldError("currentPassword")}</span>
              ) : null}
            </Field>
            <Field label="New password">
              <Input
                type="password"
                autoComplete="new-password"
                minLength={12}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                aria-invalid={passwordFieldError("newPassword") ? true : undefined}
              />
              {passwordFieldError("newPassword") ? (
                <span className="field-err">{passwordFieldError("newPassword")}</span>
              ) : null}
            </Field>
            <Button
              type="submit"
              size="sm"
              disabled={changingPassword || newPassword.length < 12}
              style={{ marginTop: 8 }}
            >
              {changingPassword ? "Updating…" : "Update password"}
            </Button>
          </form>
        </PanelBody>
      </Panel>
    </Modal>
  );
}
