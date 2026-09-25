"use client";

import { EstimateStatusPill } from "@/components/estimator/estimate-status";
import { Modal } from "@/components/ui/modal";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { round2, estimateTierTotals } from "@/lib/data/pricing";
import { dt, money2, qty } from "@/lib/format";
import { TIERS } from "@/lib/constants";
import type { Database } from "@/lib/types";

interface EstimateDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  db: Database;
  estimateId: string;
}

/**
 * A read-only view of an estimate and where it stands. It carries no
 * signature box and no approve button on purpose: an estimate is approved
 * only when the customer signs the document GoHighLevel emailed them, and
 * the app learns of it from GoHighLevel. Price only - cost is never
 * rendered, even for an Admin.
 */
export function EstimateDetail({ open, onOpenChange, db, estimateId }: EstimateDetailProps) {
  const estimate = db.estimates.find((e) => e.id === estimateId) ?? null;
  if (!estimate) return null;

  const lead = db.leads.find((l) => l.id === estimate.leadId) ?? null;
  const rep = db.users.find((u) => u.id === estimate.repId) ?? null;
  const customer = estimate.customer?.name || lead?.name || "";
  const email = estimate.customer?.email || lead?.email || "";
  const focus = estimate.acceptedTier ?? estimate.sentTier ?? null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Estimate ${estimate.number}`}
      subtitle={`${customer}${rep ? `, prepared by ${rep.name}` : ""}, ${dt(estimate.createdAt)}`}
      wide
      actions={[{ label: "Close", variant: "ghost" }]}
    >
      <div className="row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <EstimateStatusPill status={estimate.status} />
        {estimate.status === "Draft" ? (
          <span className="t-meta">Not sent yet. Use Send to email it to the customer.</span>
        ) : estimate.status === "Signed" ? (
          <span className="t-meta">
            Approved by {estimate.signedByName} on {dt(estimate.signedAt, true)}
            {estimate.acceptedTier ? `, ${estimate.acceptedTier} package` : ""}.
          </span>
        ) : (
          <span className="t-meta">
            GoHighLevel emailed {customer}
            {email ? ` (${email})` : ""} the {estimate.sentTier ?? "estimate"} package to sign. It is approved
            as soon as they sign it.
          </span>
        )}
      </div>

      {estimate.customerNotes ? (
        <p className="t-meta" style={{ margin: "0 0 14px", whiteSpace: "pre-line" }}>
          {estimate.customerNotes}
        </p>
      ) : null}

      {TIERS.map((tier) => {
        const lines = estimate.tiers[tier] ?? [];
        if (!lines.length) return null;
        const meta = estimate.tierMeta[tier];
        const totals = estimateTierTotals(lines, meta, estimate.taxRate);
        const deposit = round2(totals.totalPrice * (estimate.depositPercent / 100));

        return (
          <Panel
            key={tier}
            style={{
              marginBottom: 12,
              ...(focus === tier ? { borderColor: "var(--blue)", boxShadow: "var(--lift-2)" } : {}),
            }}
          >
            <PanelHead>
              <div className="row">
                <h3>{meta?.label || tier}</h3>
                {focus === tier ? (
                  <span className="t-meta">
                    {estimate.status === "Signed" ? "Approved package" : "Sent for approval"}
                  </span>
                ) : null}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="money-big">{money2(totals.totalPrice)}</div>
                <div className="t-meta">
                  {money2(deposit)} deposit ({estimate.depositPercent}%)
                </div>
              </div>
            </PanelHead>
            <PanelBody tight>
              {meta?.summary ? (
                <p className="t-meta" style={{ margin: "0 0 10px" }}>
                  {meta.summary}
                </p>
              ) : null}
              <ul className="scope-list">
                {totals.rows.map((row) => (
                  <li key={row.id}>
                    <span>
                      {row.name}
                      {row.description ? (
                        <span className="t-meta" style={{ display: "block" }}>
                          {row.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="q">
                      {qty(row.qty)} {row.unit}, {money2(row.linePrice)}
                    </span>
                  </li>
                ))}
              </ul>
              {totals.discountAmount > 0 || totals.taxAmount > 0 ? (
                <div className="pkg-sum">
                  <div>
                    <span>Subtotal</span>
                    <span>{money2(totals.subtotalPrice)}</span>
                  </div>
                  {totals.discountAmount > 0 ? (
                    <div className="save">
                      <span>Discount</span>
                      <span>-{money2(totals.discountAmount)}</span>
                    </div>
                  ) : null}
                  {totals.taxAmount > 0 ? (
                    <div>
                      <span>Sales tax ({estimate.taxRate}%)</span>
                      <span>{money2(totals.taxAmount)}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </PanelBody>
          </Panel>
        );
      })}
    </Modal>
  );
}
