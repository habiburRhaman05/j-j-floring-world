"use client";

import { ViewSection } from "@/components/layout/view-section";
import { useCurrentUser } from "@/components/providers/session-provider";
import { RepJobs } from "@/components/sales-rep/jobs-view";
import { useAppDb } from "@/lib/data/hooks";

export default function SalesRepJobsPage() {
  const db = useAppDb();
  const me = useCurrentUser();

  return (
    <ViewSection
      viewKey="jobs"
      heading="Won jobs"
      sub="What happens after the signature, so you can answer the customer."
    >
      <RepJobs db={db} meId={me?.id ?? ""} />
    </ViewSection>
  );
}
