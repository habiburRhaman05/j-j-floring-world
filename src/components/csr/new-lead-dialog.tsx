"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useAddLead } from "@/lib/data/hooks";
import { LEAD_SOURCES } from "@/lib/constants";
import type { Database, LeadSource } from "@/lib/types";

interface NewLeadDialogProps {
  db: Database;
  meId: string;
  onClose: () => void;
}

export function NewLeadDialog({ db, meId, onClose }: NewLeadDialogProps) {
  const addLead = useAddLead();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const reps = db.users.filter((u) => u.role === "Sales Rep");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [source, setSource] = useState<LeadSource>(LEAD_SOURCES[0]);
  const [repId, setRepId] = useState(reps[0]?.id ?? "");
  const [note, setNote] = useState("");

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title="New lead"
      subtitle="Goes straight into the New Lead column"
      actions={[
        { label: "Cancel", variant: "ghost" },
        {
          label: "Create lead",
          variant: "primary",
          keep: true,
          onClick: (close) => {
            if (!name.trim()) {
              toast("Name is required.", "warn");
              return false;
            }
            addLead.mutate([
              {
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                address: address.trim(),
                zipCode: zip.trim(),
                source,
                assignedRepId: repId,
                note: note.trim(),
                by: meId,
              },
            ]);
            toast("Lead created.", "ok");
            close();
          },
        },
      ]}
    >
      <Field label="Customer name">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <div className="field-row">
        <Field label="Phone" className="grow">
          <Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="Email" className="grow">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
      </div>

      <Field label="Address">
        <Input value={address} onChange={(event) => setAddress(event.target.value)} />
      </Field>

      <div className="field-row">
        <Field label="Zip code" className="grow">
          <Input
            inputMode="numeric"
            value={zip}
            onChange={(event) => setZip(event.target.value)}
          />
        </Field>
        <Field label="Source" className="grow">
          <Select
            value={source}
            onChange={(event) => setSource(event.target.value as LeadSource)}
          >
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assign to" className="grow">
          <Select value={repId} onChange={(event) => setRepId(event.target.value)}>
            {reps.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="First note">
        <Textarea
          placeholder="What are they asking for"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
    </Modal>
  );
}
