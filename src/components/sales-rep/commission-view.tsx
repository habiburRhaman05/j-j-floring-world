"use client";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { StagePill } from "@/components/ui/pill";
import { Stat, StatStrip } from "@/components/ui/stat";
import { repStats } from "@/lib/data/selectors";
import { money, money2, pct } from "@/lib/format";
import type { Database, Invoice, Lead } from "@/lib/types";

interface WonRow {
  lead: Lead;
  invoice: Invoice | null;
}

/** Your own numbers only. Company cost and margin are not part of this view. */
export function RepCommission({ db, meId }: { db: Database; meId: string }) {
  const stats = repStats(db, meId);

  const won: WonRow[] = db.leads
    .filter((l) => l.assignedRepId === meId && l.stage === "Won")
    .map((lead) => ({
      lead,
      invoice: db.invoices.find((i) => i.leadId === lead.id) ?? null,
    }));

  const columns: DataTableColumn<WonRow>[] = [
    { id: "customer", header: "Customer", cell: ({ row }) => row.original.lead.name },
    {
      id: "tier",
      header: "Tier",
      cell: ({ row }) => row.original.invoice?.tier ?? "-",
    },
    {
      id: "contract",
      header: "Contract",
      meta: { numeric: true },
      cell: ({ row }) => (row.original.invoice ? money2(row.original.invoice.totalPrice) : "-"),
    },
    {
      id: "commission",
      header: "Commission",
      meta: { numeric: true },
      cell: ({ row }) => (
        <span style={{ color: "var(--moss)", fontWeight: 600 }}>
          {row.original.invoice
            ? money2(row.original.invoice.totalPrice * stats.commissionRate)
            : "-"}
        </span>
      ),
    },
    {
      id: "payment",
      header: "Payment",
      cell: ({ row }) =>
        row.original.invoice ? (
          <StagePill stage={row.original.invoice.paymentStatus} />
        ) : (
          <span className="t-meta">-</span>
        ),
    },
  ];

  return (
    <>
      <StatStrip>
        <Stat label="Deals won" value={String(stats.dealsWon)} note="Signed and converted" />
        <Stat label="Close rate" value={pct(stats.closeRate)} note="Won against won plus lost" />
        <Stat
          label="Revenue written"
          value={money(stats.revenue)}
          note="Contract value of your wins"
        />
        <Stat
          label="Commission owed"
          value={money2(stats.commission)}
          note={`At ${pct(stats.commissionRate * 100)}`}
          tone="good"
        />
      </StatStrip>

      <Panel className="section">
        <PanelHead>
          <h3>Won deals</h3>
          <span className="t-meta">Commission is calculated on contract value</span>
        </PanelHead>
        {won.length ? (
          <DataTable columns={columns} data={won} />
        ) : (
          <PanelBody>
            <EmptyState title="Nothing won yet" message="Sign an estimate and it lands here." />
          </PanelBody>
        )}
      </Panel>
    </>
  );
}
