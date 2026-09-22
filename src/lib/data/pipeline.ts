import { JOB_PHASES, JOB_STAGES, SALES_STAGES } from "../constants";
import type { JobStage, LeadStage } from "../types";

/** The next stage a rep can nudge a lead into. Won is reached by signing. */
export function nextSalesStage(stage: LeadStage): LeadStage | null {
  const i = SALES_STAGES.indexOf(stage);
  if (i < 0 || stage === "Won" || stage === "Lost") return null;
  const next = SALES_STAGES[i + 1];
  return next === "Won" ? null : next;
}

export function nextJobStage(stage: JobStage): JobStage | null {
  const i = JOB_STAGES.indexOf(stage);
  if (i < 0 || i === JOB_STAGES.length - 1) return null;
  return JOB_STAGES[i + 1];
}

/** Which display phase a job's concrete stage belongs to. */
export function jobPhaseOf(stage: JobStage): string {
  for (const phase of JOB_PHASES) {
    if (phase.stages.includes(stage)) return phase.label;
  }
  return stage;
}
