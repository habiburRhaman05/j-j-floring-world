"use client";

import { EstimateStatusPill } from "@/components/estimator/estimate-status";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StageSelect } from "@/components/pipeline/stage-select";
import { useAddLeadNote, useSetLeadStage } from "@/lib/data/hooks";
import { estimatesForLead } from "@/lib/data/selectors";
import { estimateTierTotals } from "@/lib/data/pricing";
import { SALES_STAGES } from "@/lib/constants";
import { dt, money2 } from "@/lib/format";
import type { Database, Lead, LeadStage } from "@/lib/types";
import { LeadNotes } from "./lead-notes";

interface RepLeadDialogProps {
  lead: Lead;
  db: Database;
  meId: string;
  onClose: () => void;
  onBuildEstimate: (leadId: string) => void;
  onOpenEstimate: (estimateId: string) => void;
}

/**
 * PERMISSIONS: this dialog never reads costPerUnit, totalCost or totalMargin.
 * Nothing below constructs a node holding a cost or margin figure, so those
 * values are absent from the rendered DOM for this role.
 */
export function RepLeadDialog({
  lead,
  db,
  meId,
  onClose,
  onBuildEstimate,
  onOpenEstimate,
}: RepLeadDialogProps) {
  const setLeadStage = useSetLeadStage();
  const addLeadNote = useAddLeadNote();
  const { toast } = useToast();

  const [open, setOpen] = useState(true);
  const [note, setNote] = useState("");
  const estimates = estimatesForLead(db, lead.id);

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
        <dt>Source</dt>
        <dd>{lead.source}</dd>
        <dt>Appointment</dt>
        <dd>{lead.appointmentAt ? dt(lead.appointmentAt, true) : "Not booked"}</dd>
      </dl>

      <hr className="divider" />
      <div className="label">Stage</div>
      <StageSelect
        value={lead.stage}
        stages={SALES_STAGES}
        onChange={(v: LeadStage) => {
          setLeadStage.mutate([lead.id, v]);
          toast(`Stage set to ${v}.`, "ok");
        }}
      />

      <hr className="divider" />
      <div className="spread">
        <span className="label" style={{ margin: 0 }}>
          Estimates
        </span>
        <Button size="sm" variant="primary" onClick={() => onBuildEstimate(lead.id)}>
          {estimates.length ? "New version" : "Build estimate"}
        </Button>
      </div>
      {estimates.length === 0 ? (
        <div className="t-meta" style={{ marginTop: 8 }}>
          Nothing quoted yet.
        </div>
      ) : null}
      {estimates.map((estimate) => {
        const acceptedTier = estimate.acceptedTier ?? "Better";
        const totals = estimateTierTotals(
          estimate.tiers[acceptedTier] ?? [],
          estimate.tierMeta[acceptedTier],
          estimate.taxRate,
        );
        return (
          <div key={estimate.id} className="spread dotted-row">
            <div>
              <div>{estimate.id}</div>
              <div className="t-meta">
                {money2(totals.totalPrice)}, {dt(estimate.createdAt)}
              </div>
            </div>
            <div className="row">
              <EstimateStatusPill status={estimate.status} />
              <Button size="sm" onClick={() => onOpenEstimate(estimate.id)}>
                View
              </Button>
            </div>
          </div>
        );
      })}

      <hr className="divider" />
      <div className="label">Add note</div>
      <Textarea
        placeholder="Log what happened on this call or visit"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button
        size="sm"
        style={{ marginTop: 8 }}
        loading={addLeadNote.isPending}
        onClick={() => {
          const text = note.trim();
          if (!text) {
            toast("Write something first.", "warn");
            return;
          }
          addLeadNote.mutate([lead.id, text, meId], {
            onSuccess: () => {
              setNote("");
              toast("Note saved.", "ok");
            },
          });
        }}
      >
        Save note
      </Button>

      <LeadNotes notes={lead.notes ?? []} users={db.users} />
    </Modal>
  );
}
