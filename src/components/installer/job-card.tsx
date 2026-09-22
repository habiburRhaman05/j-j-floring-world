"use client";

import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { CheckField } from "@/components/ui/checkbox";
import { Pill, StagePill } from "@/components/ui/pill";
import { useSetMaterialsReceived } from "@/lib/data/hooks";
import { isToday } from "@/lib/data/installer";
import { dayLabel } from "@/lib/format";
import type { Database, Job } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PhotoSection } from "./photo-section";
import { ScopeList } from "./scope-list";
import { StatusButtons } from "./status-buttons";

interface JobCardProps {
  job: Job;
  db: Database;
  /** The first card on Today opens with its scope and status flow showing. */
  expanded?: boolean;
  onOpen: (jobId: string) => void;
}

export function JobCard({ job, db, expanded = false, onOpen }: JobCardProps) {
  const setMaterialsReceived = useSetMaterialsReceived();
  const { toast } = useToast();

  const lead = db.leads.find((l) => l.id === job.leadId) ?? null;
  const address = lead ? lead.address : "";

  return (
    <div
      className={cn(
        "job-card",
        job.stage === "Completed" ? "is-done" : isToday(job.scheduledDate) ? "is-today" : "",
      )}
    >
      <div className="jc-top">
        <div className="jc-name">{lead ? lead.name : job.leadId}</div>
        <div className="jc-addr">{address}</div>
        <div className="jc-meta">
          <StagePill stage={job.stage} />
          <Pill className="pill-outline">{dayLabel(job.scheduledDate)}</Pill>
          <Pill tone={job.materialsReceived ? "pill-moss" : "pill-clay"}>
            {job.materialsReceived ? "Materials in" : "Materials pending"}
          </Pill>
        </div>
      </div>

      {expanded ? (
        <>
          <div style={{ padding: "0 15px 13px" }}>
            <div className="label">Scope of work</div>
            <ScopeList db={db} job={job} />
            <hr className="divider" />
            <CheckField
              checked={job.materialsReceived}
              aria-label="Confirm materials received"
              onCheckedChange={(checked) => {
                setMaterialsReceived.mutate([job.id, checked]);
                toast(
                  checked ? "Materials confirmed received." : "Materials marked outstanding.",
                );
              }}
            >
              Confirm materials received
            </CheckField>
            <hr className="divider" />
            <PhotoSection job={job} />
          </div>
          <div className="jc-foot">
            <StatusButtons job={job} />
          </div>
        </>
      ) : (
        <div className="jc-foot">
          <Button size="sm" variant="primary" onClick={() => onOpen(job.id)}>
            Open job
          </Button>
          <Button size="sm" asChild>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Directions
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
