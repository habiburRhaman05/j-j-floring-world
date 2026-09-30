"use client";

import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { toApiError } from "@/lib/api/errors";
import { money2, relative } from "@/lib/format";
import { useInvoices } from "@/lib/invoices/hooks";
import type { InvoiceDisplayStatus } from "@/lib/invoices/types";

const TONE: Record<InvoiceDisplayStatus, string> = {
  Draft: "pill-outline",
  Sent: "pill-oak",
  "Partially paid": "pill-brass",
  Paid: "pill-moss",
  Overdue: "pill-clay",
  Void: "pill-slate",
};

/** GHL invoices and where each one stands. Admin sees every rep's; a rep sees their own. */
export function InvoicesPanel({ isAdmin }: { isAdmin: boolean }) {
  const query = useInvoices();
  const data = query.data;

  return (
    <Panel style={{ marginTop: 16 }}>
      <PanelHead>
        <div>
          <h3>{isAdmin ? "Invoices" : "My invoices"}</h3>
          <div className="t-meta">Live from GoHighLevel. Created when a customer signs an estimate.</div>
        </div>
        <span className="t-meta">{data ? data.invoices.length : ""}</span>
      </PanelHead>
      {data?.notice ? (
        <PanelBody>
          <div className="t-meta">{data.notice}</div>
        </PanelBody>
      ) : null}
      {query.isPending ? (
        <PanelBody>
          <div className="t-meta">Loading invoices...</div>
        </PanelBody>
      ) : query.error ? (
        <PanelBody>
          <div className="t-meta">{toApiError(query.error).displayMessage}</div>
        </PanelBody>
      ) : !data || data.invoices.length === 0 ? (
        <PanelBody>
          <div className="t-meta">No invoices yet.</div>
        </PanelBody>
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <Tr>
                <Th>Invoice</Th>
                <Th>Customer</Th>
                {isAdmin ? <Th>Sales rep</Th> : null}
                <Th>Status</Th>
                <Th numeric>Total</Th>
                <Th numeric>Paid</Th>
                <Th numeric>Due</Th>
                <Th>Issued</Th>
              </Tr>
            </THead>
            <TBody>
              {data.invoices.map((inv) => (
                <Tr key={inv.id}>
                  <Td>
                    {inv.url ? (
                      <a href={inv.url} target="_blank" rel="noopener noreferrer">
                        {inv.number}
                      </a>
                    ) : (
                      inv.number
                    )}
                    {inv.estimateNumber ? <div className="t-meta">{inv.estimateNumber}</div> : null}
                  </Td>
                  <Td>{inv.customerName}</Td>
                  {isAdmin ? <Td>{inv.repName ?? "-"}</Td> : null}
                  <Td>
                    <Pill className={TONE[inv.status]}>{inv.status}</Pill>
                  </Td>
                  <Td numeric>{money2(inv.total)}</Td>
                  <Td numeric>{money2(inv.amountPaid)}</Td>
                  <Td numeric>{money2(inv.amountDue)}</Td>
                  <Td>{inv.issuedAt ? relative(inv.issuedAt) : "-"}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </Panel>
  );
}
