import { Pill } from "@/components/ui/pill";
import type { EstimateStatus } from "@/lib/types";

/**
 * How an estimate's status reads to people. Sent and Viewed are both "waiting
 * for approval": the customer has the document and has not signed it yet.
 * Approved always means the customer signed - nobody on staff can approve.
 */
export const ESTIMATE_STATUS_LABEL: Record<EstimateStatus, string> = {
  Draft: "Draft",
  Sent: "Waiting for approval",
  Viewed: "Waiting for approval",
  Signed: "Approved",
  Expired: "Expired",
};

const TONE: Record<EstimateStatus, string> = {
  Draft: "pill-outline",
  Sent: "pill-oak",
  Viewed: "pill-brass",
  Signed: "pill-moss",
  Expired: "pill-clay",
};

export function EstimateStatusPill({ status }: { status: EstimateStatus }) {
  return (
    <Pill dot tone={TONE[status]} title={status === "Viewed" ? "The customer has opened the document" : undefined}>
      {ESTIMATE_STATUS_LABEL[status]}
      {status === "Viewed" ? " (opened)" : ""}
    </Pill>
  );
}
