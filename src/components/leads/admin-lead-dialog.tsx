"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StagePill } from "@/components/ui/pill";
import { StageSelect } from "@/components/pipeline/stage-select";
import { useSetLeadStage } from "@/lib/data/hooks";
import { estimatesForLead } from "@/lib/data/selectors";
import { SALES_STAGES } from "@/lib/constants";
import { dt } from "@/lib/format";
import type { Database, Lead, LeadStage } from "@/lib/types";
import { LeadNotes } from "./lead-notes";

interface AdminLeadDialogProps {
  lead: Lead;
  db: Database;
  onClose: () => void;
  onOpenEstimate: (estimateId: string) => void;
}

export function AdminLeadDialog({ lead, db, onClose, onOpenEstimate }: AdminLeadDialogProps) {
  const setLeadStage = useSetLeadStage();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const rep = db.users.find((u) => u.id === lead.assignedRepId) ?? null;
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
        <dt>Rep</dt>
        <dd>{rep ? rep.name : "-"}</dd>
        <dt>Created</dt>
        <dd>{dt(lead.createdAt)}</dd>
      </dl>

      <hr className="divider" />
      <div className="label">Stage</div>
      <StageSelect
        value={lead.stage}
        stages={SALES_STAGES}
        onChange={(stage: LeadStage) => {
          setLeadStage.mutate([lead.id, stage]);
          toast(`Stage set to ${stage}.`, "ok");
        }}
      />

      <hr className="divider" />
      <div className="label">Estimates</div>
      {estimates.length === 0 ? (
        <div className="t-meta">No estimate built yet.</div>
      ) : (
        estimates.map((estimate) => (
          <div key={estimate.id} className="spread dotted-row">
            <div>
              <div>
                {estimate.id}
                {estimate.acceptedTier ? `, ${estimate.acceptedTier}` : ""}
              </div>
              <div className="t-meta">{dt(estimate.createdAt)}</div>
            </div>
            <div className="row">
              <StagePill stage={estimate.status} />
              <Button size="sm" onClick={() => onOpenEstimate(estimate.id)}>
                View
              </Button>
            </div>
          </div>
        ))
      )}

      <hr className="divider" />
      <div className="label">Notes</div>
      <LeadNotes notes={lead.notes ?? []} users={db.users} />
    </Modal>
  );
}
