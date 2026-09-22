"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { Database, Job } from "@/lib/types";
import { JobCard } from "./job-card";
import { JobDetailDialog } from "./job-detail-dialog";

interface JobListProps {
  jobs: Job[];
  db: Database;
  emptyTitle: string;
  emptyMessage: string;
  expandFirst?: boolean;
}

export function JobList({ jobs, db, emptyTitle, emptyMessage, expandFirst }: JobListProps) {
  const [openJobId, setOpenJobId] = useState<string | null>(null);

  if (!jobs.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  const openJob = openJobId ? (db.jobs.find((j) => j.id === openJobId) ?? null) : null;

  return (
    <>
      {jobs.map((job, index) => (
        <JobCard
          key={job.id}
          job={job}
          db={db}
          expanded={Boolean(expandFirst && index === 0)}
          onOpen={setOpenJobId}
        />
      ))}
      {openJob ? (
        <JobDetailDialog job={openJob} db={db} onClose={() => setOpenJobId(null)} />
      ) : null}
    </>
  );
}
