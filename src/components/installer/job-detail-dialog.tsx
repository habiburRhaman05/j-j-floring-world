"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { CheckField } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { JobRail } from "@/components/pipeline/job-rail";
import { useSetMaterialsReceived } from "@/lib/data/hooks";
import { dayLabel } from "@/lib/format";
import type { Database, Job } from "@/lib/types";
import { PhotoSection } from "./photo-section";
import { ScopeList } from "./scope-list";
import { StatusButtons } from "./status-buttons";

interface JobDetailDialogProps {
  job: Job;
  db: Database;
  onClose: () => void;
}

export function JobDetailDialog({ job, db, onClose }: JobDetailDialogProps) {
  const setMaterialsReceived = useSetMaterialsReceived();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const lead = db.leads.find((l) => l.id === job.leadId) ?? null;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title={lead ? lead.name : job.id}
      subtitle={`${lead ? lead.address : ""}, ${dayLabel(job.scheduledDate)}`}
      actions={[{ label: "Close", variant: "ghost" }]}
    >
      <JobRail currentStage={job.stage} />
      <hr className="divider" />

      <div className="label">Scope of work</div>
      <ScopeList db={db} job={job} />
      <hr className="divider" />

      <CheckField
        checked={job.materialsReceived}
        aria-label="Confirm materials received"
        onCheckedChange={(checked) => {
          setMaterialsReceived.mutate([job.id, checked]);
          toast(checked ? "Materials confirmed received." : "Materials marked outstanding.");
        }}
      >
        Confirm materials received
      </CheckField>

      <hr className="divider" />
      <PhotoSection job={job} />

      <hr className="divider" />
      <div className="label">Status</div>
      <StatusButtons job={job} />
    </Modal>
  );
}
