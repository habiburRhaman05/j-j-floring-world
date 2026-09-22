"use client";

import { JobList } from "@/components/installer/job-list";
import { ViewSection } from "@/components/layout/view-section";
import { useCurrentUser } from "@/components/providers/session-provider";
import { useAppDb } from "@/lib/data/hooks";
import { completedJobs, myJobs } from "@/lib/data/installer";

export default function InstallerCompletedPage() {
  const db = useAppDb();
  const me = useCurrentUser();
  const done = completedJobs(myJobs(db, me?.id ?? ""));

  return (
    <ViewSection
      viewKey="completed"
      heading="Completed"
      sub="Closed installs, most recent first."
    >
      <JobList
        jobs={done}
        db={db}
        emptyTitle="No completed jobs yet"
        emptyMessage="Finished installs stay here for your records."
      />
    </ViewSection>
  );
}
