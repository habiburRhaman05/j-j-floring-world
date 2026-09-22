"use client";

import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { useSetJobStage } from "@/lib/data/hooks";
import { JOB_STAGES } from "@/lib/constants";
import type { Job, JobStage } from "@/lib/types";

/** Exactly one action is live at any moment. */
const FLOW: Array<{ from: JobStage; to: JobStage; label: string }> = [
  { from: "Scheduled", to: "En Route", label: "Mark En Route" },
  { from: "En Route", to: "In Progress", label: "Mark In Progress" },
  { from: "In Progress", to: "Completed", label: "Mark Completed" },
];

export function StatusButtons({ job }: { job: Job }) {
  const setJobStage = useSetJobStage();
  const { toast } = useToast();

  // A job that has not reached Scheduling yet is waiting on the office.
  if (JOB_STAGES.indexOf(job.stage) < JOB_STAGES.indexOf("Scheduled")) {
    return (
      <div className="row-wrap">
        <Pill dot tone="pill-slate">
          Waiting on the office to schedule
        </Pill>
      </div>
    );
  }

  const next = FLOW.find((step) => step.from === job.stage) ?? null;

  return (
    <div className="row-wrap">
      {FLOW.map((step) => {
        const done = JOB_STAGES.indexOf(job.stage) > JOB_STAGES.indexOf(step.from);
        const live = next?.from === step.from;

        return (
          <Button
            key={step.label}
            size="sm"
            variant={done ? "ghost" : live ? "go" : "default"}
            aria-disabled={live ? undefined : "true"}
            onClick={() => {
              if (!live) return;
              if (step.to === "Completed" && !job.materialsReceived) {
                toast("Confirm materials received before closing the job.", "warn");
                return;
              }
              setJobStage.mutate([job.id, step.to]);
              toast(step.label.replace("Mark ", "Status: "), "ok");
            }}
          >
            {done ? `${step.to} \u2713` : step.label}
          </Button>
        );
      })}

      {job.stage === "Completed" ? (
        <Pill dot tone="pill-moss">
          Job closed
        </Pill>
      ) : null}
    </div>
  );
}
