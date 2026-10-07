"use client";

import { useMemo } from "react";
import { BarChart, type ChartRow } from "@/components/ui/bar-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { Stat, StatStrip } from "@/components/ui/stat";
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { toApiError } from "@/lib/api/errors";
import { money, money2, pct, relative } from "@/lib/format";
import { useInvoices } from "@/lib/invoices/hooks";
import type { InvoiceDisplayStatus } from "@/lib/invoices/types";
import { useSalesBoard } from "@/lib/sales/hooks";
import { computeMetrics, metricsByOwner, presetRange } from "@/lib/sales/metrics";

/* ==========================================================================
   overview.tsx  -  the admin company dashboard
   --------------------------------------------------------------------------
   Everything here is read live from GoHighLevel: the Sales Pipeline for deals
   and revenue, and GHL invoices for what has been collected and what is still
   owed. (It used to read the app's own jobs/invoices tables, which stay empty
   because the work is run in GHL.)
   ========================================================================== */

const INVOICE_TONE: Record<InvoiceDisplayStatus, string> = {
  Draft: "pill-outline",
  Sent: "pill-oak",
  "Partially paid": "pill-brass",
  Paid: "pill-moss",
  Overdue: "pill-clay",
  Void: "pill-slate",
};

const INVOICE_STATUSES: InvoiceDisplayStatus[] = ["Draft", "Sent", "Partially paid", "Overdue", "Paid", "Void"];

export function AdminOverview() {
  const board = useSalesBoard();
  const invoiceQuery = useInvoices();
  const data = board.data;
  const invoices = invoiceQuery.data?.invoices;

  const all = useMemo(() => presetRange("all"), []);
  const totals = useMemo(() => (data ? computeMetrics(data.opportunities, all, data.rates) : null), [data, all]);
  const owners = useMemo(
    () => (data ? metricsByOwner(data.opportunities, data.reps, all, data.rates) : []),
    [data, all],
  );

  const funnel = useMemo<ChartRow[]>(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const o of data.opportunities) counts.set(o.stageId, (counts.get(o.stageId) ?? 0) + 1);
    return data.pipeline.stages.map((s) => ({ label: s.name, count: counts.get(s.id) ?? 0 }));
  }, [data]);

  const invoiceRows = useMemo<ChartRow[]>(
    () =>
      INVOICE_STATUSES.map((status) => ({
        label: status,
        count: (invoices ?? []).filter((i) => i.status === status).length,
        tone: status === "Paid" ? "won" : status === "Overdue" ? "lost" : undefined,
      })),
    [invoices],
  );

  if (board.isPending) {
    return <div className="skel" style={{ height: 120 }} />;
  }
  if (board.error || !data || !totals) {
    return (
      <div className="login-alert" role="alert">
        <span>{toApiError(board.error).displayMessage}</span>
      </div>
    );
  }

  // Void and draft invoices were never owed; everything else counts.
  const billed = (invoices ?? []).filter((i) => i.status !== "Void" && i.status !== "Draft");
  const collected = billed.reduce((sum, i) => sum + i.amountPaid, 0);
  const outstanding = billed.reduce((sum, i) => sum + i.amountDue, 0);
  const owed = billed.filter((i) => i.amountDue > 0).sort((a, b) => b.amountDue - a.amountDue);

  const showMargin = data.rates.marginPercent !== null && totals.estMargin !== null;
  const cost = showMargin ? totals.wonValue - (totals.estMargin ?? 0) : null;

  return (
    <>
      <StatStrip>
        <Stat label="Contracted revenue" value={money(totals.wonValue)} note={`${totals.wonCount} won deals`} />
        <Stat
          label="Cost of goods"
          value={cost === null ? "-" : money(cost)}
          note={cost === null ? "Set the margin in Sales Pipeline" : "Estimated from the average margin"}
        />
        <Stat
          label="Gross margin"
          value={totals.estMargin === null ? "-" : money(totals.estMargin)}
          note={data.rates.marginPercent === null ? "Not set" : `${pct(data.rates.marginPercent)} of revenue`}
          tone="good"
        />
        <Stat
          label="Collected"
          value={invoices ? money(collected) : "..."}
          note="Paid on GoHighLevel invoices"
        />
        <Stat
          label="Outstanding"
          value={invoices ? money(outstanding) : "..."}
          note="Balances still owed"
          tone={outstanding > 0 ? "warn" : ""}
        />
      </StatStrip>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Panel>
          <PanelHead>
            <h3>Sales funnel</h3>
            <span className="t-meta">{data.opportunities.length} deals</span>
          </PanelHead>
          <PanelBody>
            <BarChart rows={funnel} unit="deals" />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead>
            <h3>Invoices by status</h3>
            <span className="t-meta">{invoices ? `${invoices.length} invoices` : ""}</span>
          </PanelHead>
          <PanelBody>
            <BarChart rows={invoiceRows} unit="invoices" />
          </PanelBody>
        </Panel>
      </div>

      <Panel className="section" style={{ marginTop: 16 }}>
        <PanelHead>
          <h3>Sales rep leaderboard</h3>
          <span className="t-meta">Commission follows the discount given; appointment fee is paid on approved estimates</span>
        </PanelHead>
        {owners.length ? (
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>Rep</Th>
                  <Th numeric>Won</Th>
                  <Th numeric>Open</Th>
                  <Th numeric>Win rate</Th>
                  <Th numeric>Revenue</Th>
                  <Th numeric>Rate</Th>
                  <Th numeric>Commission</Th>
                  <Th numeric>Appt fees</Th>
                  <Th numeric>Total pay</Th>
                </Tr>
              </THead>
              <TBody>
                {owners.map((row, index) => (
                  <Tr key={row.ownerUserId ?? row.ownerName}>
                    <Td>
                      <div className="row">
                        <Pill tone="pill-oak">#{index + 1}</Pill>
                        <span style={{ fontWeight: 600 }}>{row.ownerName}</span>
                      </div>
                    </Td>
                    <Td numeric>{row.metrics.wonCount}</Td>
                    <Td numeric>{row.metrics.openCount}</Td>
                    <Td numeric>{row.metrics.winRate === null ? "-" : pct(row.metrics.winRate)}</Td>
                    <Td numeric>{money(row.metrics.wonValue)}</Td>
                    <Td numeric>{pct(row.commissionPercent)}</Td>
                    <Td numeric>{money2(row.metrics.commission)}</Td>
                    <Td numeric>{money2(row.metrics.appointmentFees)}</Td>
                    <Td numeric>
                      <span style={{ fontWeight: 600, color: "var(--moss)" }}>{money2(row.metrics.totalRepPay)}</span>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <PanelBody>
            <EmptyState title="No sales reps yet" message="Add a sales representative in Team." />
          </PanelBody>
        )}
      </Panel>

      <Panel className="section">
        <PanelHead>
          <h3>Outstanding balances</h3>
          <Pill tone={outstanding ? "pill-clay" : "pill-moss"}>{money(outstanding)}</Pill>
        </PanelHead>
        {invoiceQuery.isPending ? (
          <PanelBody>
            <div className="t-meta">Loading invoices...</div>
          </PanelBody>
        ) : invoiceQuery.error ? (
          <PanelBody>
            <div className="t-meta">{toApiError(invoiceQuery.error).displayMessage}</div>
          </PanelBody>
        ) : owed.length ? (
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>Invoice</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th numeric>Total</Th>
                  <Th numeric>Paid</Th>
                  <Th numeric>Owed</Th>
                  <Th>Issued</Th>
                </Tr>
              </THead>
              <TBody>
                {owed.map((inv) => (
                  <Tr key={inv.id}>
                    <Td>
                      {inv.url ? (
                        <a href={inv.url} target="_blank" rel="noopener noreferrer">
                          {inv.number}
                        </a>
                      ) : (
                        inv.number
                      )}
                    </Td>
                    <Td>{inv.customerName}</Td>
                    <Td>
                      <Pill className={INVOICE_TONE[inv.status]}>{inv.status}</Pill>
                    </Td>
                    <Td numeric>{money2(inv.total)}</Td>
                    <Td numeric>{money2(inv.amountPaid)}</Td>
                    <Td numeric>
                      <span style={{ fontWeight: 600 }}>{money2(inv.amountDue)}</span>
                    </Td>
                    <Td>{inv.issuedAt ? relative(inv.issuedAt) : "-"}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <PanelBody>
            <EmptyState title="All settled" message="Every invoice in GoHighLevel is paid in full." />
          </PanelBody>
        )}
      </Panel>
    </>
  );
}
