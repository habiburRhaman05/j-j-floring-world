"use client";

import { ViewSection } from "@/components/layout/view-section";
import { useCurrentUser } from "@/components/providers/session-provider";
import { RepEstimates } from "@/components/sales-rep/estimates-view";
import { useAppDb } from "@/lib/data/hooks";

export default function SalesRepEstimatesPage() {
  const db = useAppDb();
  const me = useCurrentUser();

  return (
    <ViewSection
      viewKey="estimates"
      heading="Estimates"
      sub="Build Good, Better and Best options, then send the signature link."
    >
      <RepEstimates db={db} meId={me?.id ?? ""} />
    </ViewSection>
  );
}
