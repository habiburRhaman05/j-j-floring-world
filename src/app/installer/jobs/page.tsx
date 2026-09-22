"use client";

import { JobList } from "@/components/installer/job-list";
import { ViewSection } from "@/components/layout/view-section";
import { useCurrentUser } from "@/components/providers/session-provider";
import { useAppDb } from "@/lib/data/hooks";
import { myJobs, openJobs } from "@/lib/data/installer";

export default function InstallerJobsPage() {
  const db = useAppDb();
  const me = useCurrentUser();
  const active = openJobs(myJobs(db, me?.id ?? ""));

  return (
    <ViewSection
      viewKey="jobs"
      heading="My jobs"
      sub="Everything assigned to you that is still open."
    >
      <JobList
        jobs={active}
        db={db}
        emptyTitle="No open jobs"
        emptyMessage="When the office schedules you, jobs land here."
      />
    </ViewSection>
  );
}
