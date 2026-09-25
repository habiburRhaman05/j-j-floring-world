"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError, type ApiError } from "@/lib/api/errors";
import { formErrors } from "@/lib/api/form-errors";
import { relative } from "@/lib/format";

/* ==========================================================================
   team-view.tsx  -  real, database-backed team roster
   --------------------------------------------------------------------------
   Talks to /api/users (list, invite, edit, suspend/reactivate, remove), not
   the mock dataset. One role per user for now, matching the invite flow;
   the full multi-role permission vault (doc 04) is a later pass once fields
   that actually need it are built.

   The list is a React Query, not local state, so:
   - every mutation below invalidates it, refreshing the table immediately
     for the admin who took the action;
   - `refetchOnWindowFocus` catches the other case - someone accepted an
     invite, or a status changed, while this tab was in the background -
     without the admin having to hit reload;
   - a light 20s poll is the fallback for a tab that never loses focus.

   Email sending is stubbed (it logs to the server console rather than
   actually delivering - no provider has been chosen yet), so the invite
   link is surfaced directly in this UI for the admin to copy and send
   however they like, instead of assuming the invitee received an email.
   ========================================================================== */

interface TeamUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  lastLoginAt: string | null;
  /** "account:admin" / "account:user", or null for a user not imported from GHL. */
  ghlRole: string | null;
  roles: { id: string; key: string; name: string }[];
}

interface PendingInvitation {
  id: string;
  email: string;
  roleKey: string;
  roleName: string;
  expiresAt: string;
}

interface TeamData {
  users: TeamUser[];
  invitations: PendingInvitation[];
}

/** The four system roles this build's dashboards are built around (doc 04). Custom roles are a later pass. */
const ROLE_OPTIONS = [
  { key: "admin", name: "Administrator" },
  { key: "sales_rep", name: "Sales Representative" },
  { key: "csr", name: "CSR" },
  { key: "installer", name: "Installer" },
];

const TEAM_QUERY_KEY = ["admin", "team"] as const;

function fetchTeam(): Promise<TeamData> {
  return apiGet<TeamData>(endpoints.users.list);
}

export function AdminTeam() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: TEAM_QUERY_KEY,
    queryFn: fetchTeam,
    staleTime: 15_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 20_000,
  });

  const users = data?.users ?? [];
  const invitations = data?.invitations ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [linkModal, setLinkModal] = useState<{ email: string; link: string } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function resend(invite: PendingInvitation) {
    setResendingId(invite.id);
    try {
      const result = await apiPost<{ inviteLink: string }>(endpoints.users.create, {
        email: invite.email,
        roleKey: invite.roleKey,
      });
      setLinkModal({ email: invite.email, link: result.inviteLink });
      invalidate();
    } catch (thrown) {
      toast(toApiError(thrown).displayMessage, "warn");
    } finally {
      setResendingId(null);
    }
  }

  async function toggleStatus(user: TeamUser) {
    setBusyId(user.id);
    const suspended = user.status === "SUSPENDED";
    try {
      await apiPost(suspended ? endpoints.users.reactivate(user.id) : endpoints.users.suspend(user.id));
      toast(suspended ? `${user.firstName} reactivated.` : `${user.firstName} suspended.`, "ok");
      invalidate();
    } catch (thrown) {
      toast(toApiError(thrown).displayMessage, "warn");
    } finally {
      setBusyId(null);
    }
  }

  const columns: DataTableColumn<TeamUser>[] = [
    {
      id: "name",
      header: "Name",
      accessorFn: (u) => `${u.firstName} ${u.lastName}`,
    },
    {
      accessorKey: "email",
      header: "Sign-in email",
      cell: ({ row }) => <span className="t-meta">{row.original.email}</span>,
    },
    {
      id: "roles",
      header: "App role",
      meta: { className: "col-tight" },
      cell: ({ row }) => (
        <div className="row" style={{ gap: 6 }}>
          {row.original.roles.map((r) => (
            <Pill key={r.id} className="pill-outline">
              {r.name}
            </Pill>
          ))}
        </div>
      ),
    },
    {
      id: "ghlRole",
      header: "GHL role",
      meta: { className: "col-tight muted" },
      cell: ({ row }) => {
        const ghl = row.original.ghlRole;
        if (!ghl) return "Not linked";
        const role = ghl.split(":")[1] ?? ghl;
        return role === "admin" ? "Admin" : role === "user" ? "User" : ghl;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { className: "col-tight" },
      cell: ({ row }) => (
        <Pill className={row.original.status === "SUSPENDED" ? "pill-clay" : "pill-outline"}>
          {row.original.status}
        </Pill>
      ),
    },
    {
      id: "lastLogin",
      header: "Last active",
      meta: { className: "col-tight" },
      cell: ({ row }) => <span className="t-meta">{relative(row.original.lastLoginAt)}</span>,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { className: "col-tight" },
      cell: ({ row }) => {
        const user = row.original;
        const busy = busyId === user.id;
        return (
          <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
            <Button size="sm" onClick={() => setEditUser(user)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggleStatus(user)}>
              {user.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div className="t-sub">
          Every account signs in with its email. The role decides what that login can open.
          {isFetching && !isLoading ? <span className="t-meta"> · refreshing…</span> : null}
        </div>
        <Button size="sm" variant="primary" onClick={() => setInviteOpen(true)}>
          Invite user
        </Button>
      </div>

      <Panel>
        {isLoading ? (
          <TeamTableSkeleton />
        ) : isError ? (
          <PanelBody>
            <p className="t-sub" role="alert">
              {toApiError(error).displayMessage}
            </p>
            <Button size="sm" variant="ghost" onClick={() => invalidate()} style={{ marginTop: 8 }}>
              Try again
            </Button>
          </PanelBody>
        ) : (
          <DataTable columns={columns} data={users} enableSorting />
        )}
      </Panel>

      {invitations.length > 0 ? (
        <Panel style={{ marginTop: 16 }}>
          <PanelHead>Pending invitations</PanelHead>
          <PanelBody tight>
            <p className="t-meta" style={{ marginBottom: 8 }}>
              Email delivery isn&apos;t wired up yet - use &quot;Get link&quot; to copy the
              sign-up link and send it yourself.
            </p>
            {invitations.map((invite) => (
              <div key={invite.id} className="spread" style={{ padding: "8px 0" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{invite.email}</div>
                  <div className="t-meta">Invited as {invite.roleName}</div>
                </div>
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  <Pill className="pill-outline">
                    Expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </Pill>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={resendingId === invite.id}
                    onClick={() => resend(invite)}
                  >
                    {resendingId === invite.id ? "Generating…" : "Get link"}
                  </Button>
                </div>
              </div>
            ))}
          </PanelBody>
        </Panel>
      ) : null}

      {inviteOpen ? (
        <InviteDialog
          onClose={() => setInviteOpen(false)}
          onInvited={(email, link) => {
            setInviteOpen(false);
            toast(`Invitation created for ${email}.`, "ok");
            setLinkModal({ email, link });
            invalidate();
          }}
        />
      ) : null}

      {linkModal ? (
        <InviteLinkModal
          email={linkModal.email}
          link={linkModal.link}
          onClose={() => setLinkModal(null)}
        />
      ) : null}

      {editUser ? (
        <EditUserDialog
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            invalidate();
          }}
        />
      ) : null}

    </>
  );
}

/** Mirrors the real table's structure so there is no layout shift once data lands. */
function TeamTableSkeleton() {
  return (
    <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            <th>Name</th>
            <th>Sign-in email</th>
            <th className="col-tight">Role</th>
            <th className="col-tight">Status</th>
            <th className="col-tight">Last active</th>
            <th className="col-tight" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }).map((_, i) => (
            <tr key={i}>
              <td>
                <Skeleton style={{ width: 140 }} />
              </td>
              <td>
                <Skeleton style={{ width: 190 }} />
              </td>
              <td className="col-tight">
                <Skeleton style={{ width: 90 }} />
              </td>
              <td className="col-tight">
                <Skeleton style={{ width: 70 }} />
              </td>
              <td className="col-tight">
                <Skeleton style={{ width: 80 }} />
              </td>
              <td className="col-tight">
                <Skeleton style={{ width: 150 }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InviteDialog({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (email: string, link: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState(ROLE_OPTIONS[1]!.key);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { fieldError, generalError } = formErrors(error);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await apiPost<{ inviteLink: string }>(endpoints.users.create, {
        email,
        roleKey,
      });
      onInvited(email, result.inviteLink);
    } catch (thrown) {
      setError(toApiError(thrown));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onOpenChange={onClose} title="Invite a team member">
      <form onSubmit={onSubmit} noValidate>
        {generalError ? (
          <div className="login-alert" role="alert" style={{ marginBottom: 12 }}>
            {generalError}
          </div>
        ) : null}
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
            aria-invalid={fieldError("email") ? true : undefined}
          />
          {fieldError("email") ? <span className="field-err">{fieldError("email")}</span> : null}
        </Field>
        <Field label="Role">
          <Select value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
            {ROLE_OPTIONS.map((role) => (
              <option key={role.key} value={role.key}>
                {role.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="primary" disabled={pending} style={{ marginTop: 12 }}>
          {pending ? "Creating…" : "Create invitation"}
        </Button>
      </form>
    </Modal>
  );
}

function InviteLinkModal({
  email,
  link,
  onClose,
}: {
  email: string;
  link: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast("Link copied.", "ok");
    } catch {
      toast("Could not copy automatically - select and copy the link manually.", "warn");
    }
  }

  return (
    <Modal open onOpenChange={onClose} title="Invitation link" actions={[{ label: "Done", variant: "primary" }]}>
      <p className="t-sub">
        Send this link to <strong>{email}</strong> however you like (email, text, chat).
        It expires in 7 days and can only be used once.
      </p>
      <Panel style={{ marginTop: 12 }}>
        <PanelBody tight>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <Input readOnly value={link} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
            <Button size="sm" variant={copied ? "ghost" : "primary"} onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </PanelBody>
      </Panel>
    </Modal>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: TeamUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [roleKey, setRoleKey] = useState(user.roles[0]?.key ?? ROLE_OPTIONS[1]!.key);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { fieldError, generalError } = formErrors(error);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiPatch(endpoints.users.detail(user.id), { firstName, lastName, roleKey });
      onSaved();
    } catch (thrown) {
      setError(toApiError(thrown));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={onClose} title={`Edit ${user.firstName} ${user.lastName}`}>
      <form onSubmit={onSubmit} noValidate>
        {generalError ? (
          <div className="login-alert" role="alert" style={{ marginBottom: 12 }}>
            {generalError}
          </div>
        ) : null}
        <div className="spread" style={{ gap: 12 }}>
          <Field label="First name" style={{ flex: 1 }}>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus />
          </Field>
          <Field label="Last name" style={{ flex: 1 }}>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </Field>
        </div>
        <Field label="Role">
          <Select value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
            {ROLE_OPTIONS.map((role) => (
              <option key={role.key} value={role.key}>
                {role.name}
              </option>
            ))}
          </Select>
          {fieldError("roleKey") ? <span className="field-err">{fieldError("roleKey")}</span> : null}
        </Field>
        <Button type="submit" variant="primary" disabled={saving} style={{ marginTop: 12 }}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Modal>
  );
}
