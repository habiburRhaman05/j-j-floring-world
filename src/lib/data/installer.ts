import type { Database, Job } from "../types";

/** Only ever the signed-in installer's own jobs; another crew's never appear. */
export function myJobs(db: Database, installerId: string): Job[] {
  return db.jobs.filter((j) => j.installerId === installerId);
}

export function sortByScheduled(a: Job, b: Job): number {
  return new Date(a.scheduledDate ?? 0).getTime() - new Date(b.scheduledDate ?? 0).getTime();
}

export function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

export function todayJobs(jobs: Job[]): Job[] {
  return jobs.filter((j) => isToday(j.scheduledDate) && j.stage !== "Completed").sort(sortByScheduled);
}

export function openJobs(jobs: Job[]): Job[] {
  return jobs.filter((j) => j.stage !== "Completed").sort(sortByScheduled);
}

export function completedJobs(jobs: Job[]): Job[] {
  return jobs.filter((j) => j.stage === "Completed").sort(sortByScheduled).reverse();
}
