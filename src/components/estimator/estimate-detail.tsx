"use client";

import { useState, useCallback } from "react";
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
 * only when the customer signs the document emailed to them, and
 * the app learns of it from the connected account. Price only - cost is never
 * rendered, even for an Admin.
 */
export function EstimateDetail({ open, onOpenChange, db, estimateId }: EstimateDetailProps) {
  const estimate = db.estimates.find((e) => e.id === estimateId) ?? null;
  const [copied, setCopied] = useState(false);
  const copyLink = useCallback(() => {
    if (!estimate?.webViewUrl) return;
    // Include documentUrl as docsLink query param when available
    const url = estimate.documentUrl
      ? `${estimate.webViewUrl}?docsLink=${encodeURIComponent(estimate.documentUrl)}`
      : estimate.webViewUrl;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [estimate?.webViewUrl, estimate?.documentUrl]);

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
            The document was emailed to {customer}
            {email ? ` (${email})` : ""} the {estimate.sentTier ?? "estimate"} package to sign. It is approved
            as soon as they sign it.
          </span>
        )}
      </div>

      {estimate.webViewUrl ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
            padding: "8px 12px",
            background: "var(--blue-tint)",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flex: "none" }}>
            <path
              d="M6.5 9.5l3-3M7 11l-1.15 1.15a2.12 2.12 0 01-3-3L4 8m5-3l1.15-1.15a2.12 2.12 0 013 3L12 8"
              stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
          <span className="t-meta" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Web view link
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={copyLink}
            style={{ flex: "none" }}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      ) : null}

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
