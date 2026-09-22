"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useSaveUser } from "@/lib/data/hooks";
import type { Role, User } from "@/lib/types";

const ROLES: Role[] = ["Admin", "Sales Rep", "CSR", "Installer"];

interface UserFormDialogProps {
  user: User | null;
  onClose: () => void;
}

export function UserFormDialog({ user, onClose }: UserFormDialogProps) {
  const saveUser = useSaveUser();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "Sales Rep");
  const [rate, setRate] = useState(user ? String(user.commissionRate) : "0.06");

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title={user ? "Edit user" : "Add user"}
      actions={[
        { label: "Cancel", variant: "ghost" },
        {
          label: "Save",
          variant: "primary",
          keep: true,
          onClick: (close) => {
            if (!name.trim()) {
              toast("Name is required.", "warn");
              return false;
            }
            // The email is the sign-in identity, so it cannot be blank.
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
              toast("A valid sign-in email is required.", "warn");
              return false;
            }
            saveUser.mutate([
              {
                id: user?.id ?? null,
                name: name.trim(),
                email: email.trim().toLowerCase(),
                role,
                commissionRate: rate,
              },
            ]);
            toast("User saved.", "ok");
            close();
          },
        },
      ]}
    >
      <Field label="Name">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Sign-in email">
        <Input
          type="email"
          value={email}
          placeholder="name@jjflooringworld.com"
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <div className="field-row">
        <Field label="Role" className="grow">
          <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Commission rate (0.06 = 6%)" className="grow">
          <Input
            type="number"
            step="0.005"
            min="0"
            max="1"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
