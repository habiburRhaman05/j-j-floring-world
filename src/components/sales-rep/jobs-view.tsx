"use client";

import { JobRail } from "@/components/pipeline/job-rail";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { StagePill } from "@/components/ui/pill";
import { invoiceForJob } from "@/lib/data/selectors";
import { dayLabel, money2 } from "@/lib/format";
import type { Database } from "@/lib/types";

/** What happens after the signature, so a rep can answer the customer. */
export function RepJobs({ db, meId }: { db: Database; meId: string }) {
  const myLeadIds = db.leads.filter((l) => l.assignedRepId === meId).map((l) => l.id);
  const jobs = db.jobs.filter((j) => myLeadIds.includes(j.leadId));

  if (!jobs.length) {
    return (
      <EmptyState
        title="No jobs yet"
        message="A job appears here the moment one of your estimates is signed."
      />
    );
  }

  return (
    <>
      {jobs.map((job) => {
        const lead = db.leads.find((l) => l.id === job.leadId) ?? null;
        const invoice = invoiceForJob(db, job.id);
        const installer = db.users.find((u) => u.id === job.installerId) ?? null;

        return (
          <Panel key={job.id} style={{ marginBottom: 16 }}>
            <PanelHead>
              <div>
                <h3>{lead ? lead.name : job.leadId}</h3>
                <div className="t-meta">{lead ? lead.address : ""}</div>
              </div>
              <StagePill stage={job.stage} />
            </PanelHead>
            <PanelBody>
              <JobRail currentStage={job.stage} />
              <hr className="divider" />
              <dl className="kv">
                <dt>Scheduled</dt>
                <dd>{dayLabel(job.scheduledDate)}</dd>
                <dt>Installer</dt>
                <dd>{installer ? installer.name : "Not assigned"}</dd>
                <dt>Materials</dt>
                <dd>{job.materialsReceived ? "Received" : "Outstanding"}</dd>
                <dt>Contract value</dt>
                <dd>{invoice ? money2(invoice.totalPrice) : "-"}</dd>
                <dt>Payment</dt>
                <dd>{invoice ? invoice.paymentStatus : "-"}</dd>
              </dl>
            </PanelBody>
          </Panel>
        );
      })}
    </>
  );
}
