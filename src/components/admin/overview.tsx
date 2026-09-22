"use client";

import { useState } from "react";
import { InvoiceDialog } from "@/components/invoice/invoice-dialog";
import { BarChart } from "@/components/ui/bar-chart";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill, StagePill } from "@/components/ui/pill";
import { Stat, StatStrip } from "@/components/ui/stat";
import { amountOwed, companyTotals, jobPipelineCounts, repStats, salesFunnel } from "@/lib/data/selectors";
import { money, money2, pct } from "@/lib/format";
import type { Database, Invoice, RepStats, Role } from "@/lib/types";
// The overview is Admin-only, so the Role prop is simply "Admin" at the route.

export function AdminOverview({ db, role }: { db: Database; role: Role }) {
  const totals = companyTotals(db);

  const reps = db.users
    .filter((u) => u.role === "Sales Rep")
    .map((u) => repStats(db, u.id))
    .sort((a, b) => b.revenue - a.revenue);

  const openInvoices = db.invoices.filter((i) => i.paymentStatus !== "Paid");
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const openInvoice = openInvoiceId
    ? (db.invoices.find((i) => i.id === openInvoiceId) ?? null)
    : null;

  const leaderboardColumns: DataTableColumn<RepStats>[] = [
    {
      id: "rep",
      header: "Rep",
      cell: ({ row }) => (
        <div className="row">
          <Pill tone="pill-oak">#{reps.findIndex((r) => r.repId === row.original.repId) + 1}</Pill>
          <span style={{ fontWeight: 600 }}>{row.original.name}</span>
        </div>
      ),
    },
    { accessorKey: "dealsWon", header: "Won", meta: { numeric: true } },
    { accessorKey: "openLeads", header: "Open", meta: { numeric: true } },
    {
      id: "closeRate",
      header: "Close rate",
      meta: { numeric: true },
      cell: ({ row }) => pct(row.original.closeRate),
    },
    {
      id: "revenue",
      header: "Revenue",
      meta: { numeric: true },
      cell: ({ row }) => money(row.original.revenue),
    },
    {
      id: "rate",
      header: "Rate",
      meta: { numeric: true },
      cell: ({ row }) => pct(row.original.commissionRate * 100),
    },
    {
      id: "commission",
      header: "Commission",
      meta: { numeric: true },
      cell: ({ row }) => (
        <span style={{ fontWeight: 600, color: "var(--moss)" }}>
          {money2(row.original.commission)}
        </span>
      ),
    },
  ];

  const outstandingColumns: DataTableColumn<Invoice>[] = [
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const lead = db.leads.find((l) => l.id === row.original.leadId);
        return lead ? lead.name : row.original.leadId;
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StagePill stage={row.original.paymentStatus} />,
    },
    {
      id: "contract",
      header: "Contract",
      meta: { numeric: true },
      cell: ({ row }) => money2(row.original.totalPrice),
    },
    {
      id: "deposit",
      header: "Deposit",
      meta: { numeric: true, className: "muted" },
      cell: ({ row }) => money2(row.original.depositAmount),
    },
    {
      id: "owed",
      header: "Owed",
      meta: { numeric: true },
      cell: ({ row }) => (
        <span style={{ fontWeight: 600 }}>{money2(amountOwed(row.original))}</span>
      ),
    },
    {
      id: "action",
      header: "",
      cell: ({ row }) => (
        <Button size="sm" onClick={() => setOpenInvoiceId(row.original.id)}>
          Open invoice
        </Button>
      ),
    },
  ];

  return (
    <>
      <StatStrip>
        <Stat
          label="Contracted revenue"
          value={money(totals.revenue)}
          note={`${totals.jobCount} jobs on the books`}
        />
        <Stat label="Cost of goods" value={money(totals.cost)} note="Materials and labour" />
        <Stat
          label="Gross margin"
          value={money(totals.margin)}
          note={`${pct(totals.marginPct)} of revenue`}
          tone="good"
        />
        <Stat label="Collected" value={money(totals.collected)} note="Deposits plus paid balances" />
        <Stat
          label="Outstanding"
          value={money(totals.outstanding)}
          note="Balances still owed"
          tone={totals.outstanding > 0 ? "warn" : ""}
        />
      </StatStrip>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Panel>
          <PanelHead>
            <h3>Sales funnel</h3>
            <span className="t-meta">{db.leads.length} leads</span>
          </PanelHead>
          <PanelBody>
            <BarChart rows={salesFunnel(db)} unit="leads" />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead>
            <h3>Job pipeline</h3>
            <span className="t-meta">{db.jobs.length} jobs</span>
          </PanelHead>
          <PanelBody>
            <BarChart rows={jobPipelineCounts(db)} unit="jobs" />
          </PanelBody>
        </Panel>
      </div>

      <Panel className="section">
        <PanelHead>
          <h3>Sales rep leaderboard</h3>
          <span className="t-meta">Commission owed is revenue times rate</span>
        </PanelHead>
        <DataTable columns={leaderboardColumns} data={reps} />
      </Panel>

      <Panel className="section">
        <PanelHead>
          <h3>Outstanding balances</h3>
          <Pill tone={totals.outstanding ? "pill-clay" : "pill-moss"}>
            {money(totals.outstanding)}
          </Pill>
        </PanelHead>
        {openInvoices.length ? (
          <DataTable columns={outstandingColumns} data={openInvoices} />
        ) : (
          <PanelBody>
            <EmptyState title="All settled" message="Every invoice on the books is paid in full." />
          </PanelBody>
        )}
      </Panel>

      {openInvoice ? (
        <InvoiceDialog
          open
          onOpenChange={(next) => {
            if (!next) setOpenInvoiceId(null);
          }}
          invoice={openInvoice}
          db={db}
          role={role}
        />
      ) : null}
    </>
  );
}
