"use client";

import { AdminJobs } from "@/components/admin/jobs-view";
import { ViewSection } from "@/components/layout/view-section";
import { useAppDb } from "@/lib/data/hooks";

export default function AdminJobsPage() {
  const db = useAppDb();

  return (
    <ViewSection
      viewKey="jobs"
      heading="Jobs and invoices"
      sub="Schedule installers, track stage, record payments."
    >
      <AdminJobs db={db} />
    </ViewSection>
  );
}
