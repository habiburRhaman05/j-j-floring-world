"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHead } from "@/components/ui/panel";
import { StagePill } from "@/components/ui/pill";
import { jobFinancials, invoiceForJob } from "@/lib/data/selectors";
import { dayLabel, money } from "@/lib/format";
import type { Database, Job } from "@/lib/types";
import { JobManageDialog } from "./job-manage-dialog";

export function AdminJobs({ db }: { db: Database }) {
  const [manageJobId, setManageJobId] = useState<string | null>(null);

  if (!db.jobs.length) {
    return (
      <EmptyState
        title="No jobs yet"
        message="A job is created automatically the moment an estimate is signed."
      />
    );
  }

  const columns: DataTableColumn<Job>[] = [
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const lead = db.leads.find((l) => l.id === row.original.leadId);
        return (
          <>
            <div style={{ fontWeight: 600 }}>{lead ? lead.name : row.original.leadId}</div>
            <div className="t-meta">{lead ? lead.address : ""}</div>
          </>
        );
      },
    },
    {
      id: "stage",
      header: "Stage",
      cell: ({ row }) => <StagePill stage={row.original.stage} />,
    },
    {
      id: "scheduled",
      header: "Scheduled",
      cell: ({ row }) => dayLabel(row.original.scheduledDate),
    },
    {
      id: "installer",
      header: "Installer",
      cell: ({ row }) => {
        const installer = db.users.find((u) => u.id === row.original.installerId);
        return (
          <span className={installer ? undefined : "muted"}>{installer ? installer.name : "-"}</span>
        );
      },
    },
    {
      id: "price",
      header: "Price",
      meta: { numeric: true },
      cell: ({ row }) => money(jobFinancials(db, row.original.id).totalPrice),
    },
    {
      id: "cost",
      header: "Cost",
      meta: { numeric: true, className: "muted" },
      cell: ({ row }) => money(jobFinancials(db, row.original.id).totalCost),
    },
    {
      id: "margin",
      header: "Margin",
      meta: { numeric: true },
      cell: ({ row }) => (
        <span style={{ color: "var(--moss)", fontWeight: 600 }}>
          {money(jobFinancials(db, row.original.id).totalMargin)}
        </span>
      ),
    },
    {
      id: "invoice",
      header: "Invoice",
      cell: ({ row }) => {
        const invoice = invoiceForJob(db, row.original.id);
        return invoice ? <StagePill stage={invoice.paymentStatus} /> : <span className="t-meta">-</span>;
      },
    },
    {
      id: "manage",
      header: "",
      cell: ({ row }) => (
        <Button size="sm" onClick={() => setManageJobId(row.original.id)}>
          Manage
        </Button>
      ),
    },
  ];

  const job = manageJobId ? (db.jobs.find((j) => j.id === manageJobId) ?? null) : null;

  return (
    <>
      <Panel>
        <PanelHead>
          <h3>All jobs</h3>
          <span className="t-meta">Cost and margin columns are Admin only</span>
        </PanelHead>
        <DataTable columns={columns} data={db.jobs} />
      </Panel>

      {job ? <JobManageDialog job={job} db={db} onClose={() => setManageJobId(null)} /> : null}
    </>
  );
}
