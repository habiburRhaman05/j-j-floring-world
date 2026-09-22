import { JOB_PHASES } from "@/lib/constants";
import { jobPhaseOf } from "@/lib/data/pipeline";
import type { JobStage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Where a job stands across the install phases, done / current / upcoming. */
export function JobRail({ currentStage }: { currentStage: JobStage }) {
  const currentPhase = jobPhaseOf(currentStage);
  const index = JOB_PHASES.map((p) => p.label).indexOf(currentPhase);

  return (
    <div className="rail">
      {JOB_PHASES.map((phase, i) => {
        const state = i < index ? "done" : i === index ? "current" : "";
        const label =
          i === index && phase.stages.length > 1
            ? `${phase.label} (${currentStage})`
            : phase.label;
        return (
          <div key={phase.label} className={cn("rail-step", state)}>
            <span className="dot" />
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
