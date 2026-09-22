"use client";

import { JobList } from "@/components/installer/job-list";
import { ViewSection } from "@/components/layout/view-section";
import { useCurrentUser } from "@/components/providers/session-provider";
import { useAppDb } from "@/lib/data/hooks";
import { myJobs, todayJobs } from "@/lib/data/installer";

export default function InstallerTodayPage() {
  const db = useAppDb();
  const me = useCurrentUser();
  const today = todayJobs(myJobs(db, me?.id ?? ""));

  const todayDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <ViewSection viewKey="today" heading="Today" sub={todayDate}>
      <JobList
        jobs={today}
        db={db}
        expandFirst
        emptyTitle="Nothing on today"
        emptyMessage="No installs are scheduled for you today. Check Upcoming for what is next."
      />
    </ViewSection>
  );
}
