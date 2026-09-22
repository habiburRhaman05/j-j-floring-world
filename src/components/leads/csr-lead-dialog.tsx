"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StageSelect } from "@/components/pipeline/stage-select";
import { useAddLeadNote, useSetAppointment, useSetLeadStage } from "@/lib/data/hooks";
import { CSR_STAGES } from "@/lib/constants";
import { dt, toInputDate } from "@/lib/format";
import type { CsrStage, Database, Lead } from "@/lib/types";
import { LeadNotes } from "./lead-notes";

interface CsrLeadDialogProps {
  lead: Lead;
  db: Database;
  /** The signed-in CSR, credited on every note. */
  meId: string;
  onClose: () => void;
}

/**
 * PERMISSIONS: this dialog never touches products, estimates, invoices,
 * commission or any money field. There is no price anywhere in the markup it
 * builds, and the stage select is limited to the three intake stages.
 */
export function CsrLeadDialog({ lead, db, meId, onClose }: CsrLeadDialogProps) {
  const setLeadStage = useSetLeadStage();
  const setAppointment = useSetAppointment();
  const addLeadNote = useAddLeadNote();
  const { toast } = useToast();

  const [open, setOpen] = useState(true);
  const rep = db.users.find((u) => u.id === lead.assignedRepId) ?? null;

  const [date, setDate] = useState(toInputDate(lead.appointmentAt));
  const [time, setTime] = useState(
    lead.appointmentAt ? new Date(lead.appointmentAt).toTimeString().slice(0, 5) : "10:00",
  );
  const [note, setNote] = useState("");

  function logNote(text: string) {
    addLeadNote.mutate([lead.id, text, meId]);
    if (lead.stage === "New Lead") setLeadStage.mutate([lead.id, "Contacted"]);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title={lead.name}
      subtitle={`${lead.zipCode}, ${lead.stage}`}
      wide
      actions={[{ label: "Close", variant: "ghost" }]}
    >
      <dl className="kv">
        <dt>Phone</dt>
        <dd>{lead.phone}</dd>
        <dt>Email</dt>
        <dd>{lead.email}</dd>
        <dt>Address</dt>
        <dd>{lead.address}</dd>
        <dt>Zip</dt>
        <dd>{lead.zipCode}</dd>
        <dt>Source</dt>
        <dd>{lead.source}</dd>
        <dt>Assigned rep</dt>
        <dd>{rep ? rep.name : "Unassigned"}</dd>
        <dt>Created</dt>
        <dd>{dt(lead.createdAt)}</dd>
      </dl>

      <hr className="divider" />
      <div className="label">Stage</div>
      <StageSelect
        value={lead.stage}
        stages={CSR_STAGES}
        onChange={(stage: CsrStage) => {
          setLeadStage.mutate([lead.id, stage]);
          toast(`Moved to ${stage}.`, "ok");
        }}
      />
      <div className="t-meta" style={{ marginTop: 6 }}>
        A CSR can move a lead through intake only. Qualifying and quoting belong to the
        estimator.
      </div>

      <hr className="divider" />
      <div className="label">Schedule an appointment</div>
      <div className="field-row">
        <div className="field grow" style={{ marginBottom: 0 }}>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="field" style={{ flex: "0 0 130px", marginBottom: 0 }}>
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </div>
      </div>
      <Button
        size="sm"
        variant="primary"
        style={{ marginTop: 12 }}
        onClick={() => {
          if (!date) {
            toast("Pick a date first.", "warn");
            return;
          }
          const when = new Date(`${date}T${time || "10:00"}:00`);
          setAppointment.mutate([lead.id, when.toISOString()]);
          toast(`Appointment booked for ${dt(when.toISOString(), true)}.`, "ok");
        }}
      >
        Book it
      </Button>

      <hr className="divider" />
      <div className="label">Log outreach</div>
      <Textarea
        placeholder="What did they say on the call"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="row-wrap" style={{ marginTop: 8 }}>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            const text = note.trim();
            if (!text) {
              toast("Write something first.", "warn");
              return;
            }
            logNote(text);
            setNote("");
            toast("Outreach logged.", "ok");
          }}
        >
          Save note
        </Button>
        <Button
          size="sm"
          onClick={() => {
            logNote("Left voicemail.");
            toast("Voicemail logged.");
          }}
        >
          Log &quot;left voicemail&quot;
        </Button>
      </div>

      <LeadNotes notes={lead.notes ?? []} users={db.users} />
    </Modal>
  );
}
