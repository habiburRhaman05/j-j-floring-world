"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Modal } from "@/components/ui/modal";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { StagePill } from "@/components/ui/pill";
import { useAppStore, useMarkEstimateViewed } from "@/lib/data/hooks";
import { round2, estimateTierTotals } from "@/lib/data/pricing";
import { dt, money2, qty } from "@/lib/format";
import { TIERS } from "@/lib/constants";
import type { Database, Tier } from "@/lib/types";

interface SignSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  db: Database;
  estimateId: string;
}

/**
 * Simulates the link the customer receives by text or email. Price only,
 * always: this screen is customer-facing, so cost is never rendered even when
 * an Admin is the one looking at it.
 */
export function SignSheet({ open, onOpenChange, db, estimateId }: SignSheetProps) {
  const { store, invalidate } = useAppStore();
  const markViewed = useMarkEstimateViewed();
  const { toast } = useToast();

  const estimate = db.estimates.find((e) => e.id === estimateId) ?? null;
  const [chosen, setChosen] = useState<Tier>(estimate?.acceptedTier ?? "Better");
  const [typedName, setTypedName] = useState(estimate?.signedByName ?? "");

  // Opening the customer link marks the estimate Viewed, once.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    if (estimate && estimate.status === "Sent") markViewed.mutate([estimate.id]);
  }, [estimate, markViewed]);

  if (!estimate) return null;

  const lead = db.leads.find((l) => l.id === estimate.leadId) ?? null;
  const rep = db.users.find((u) => u.id === estimate.repId) ?? null;
  const isSigned = estimate.status === "Signed";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isSigned ? "Signed proposal" : "Review and sign"}
      subtitle={
        isSigned
          ? `Estimate ${estimate.id}`
          : "Simulates the link the customer receives by text or email"
      }
      wide
      actions={
        isSigned
          ? [{ label: "Close", variant: "ghost" }]
          : [
              { label: "Close", variant: "ghost" },
              {
                label: "Sign and accept",
                variant: "go",
                keep: true,
                onClick: async (close) => {
                  const typed = typedName.trim();
                  if (typed.length < 3) {
                    toast("Type the full name to sign.", "warn");
                    return false;
                  }
                  await store.signEstimate(estimate.id, typed, chosen);
                  invalidate();
                  toast("Signed. Deal marked Won - installer scheduling is next.", "ok", 4200);
                  close();
                },
              },
            ]
      }
    >
      <div className="signsheet">
        <div className="ss-head">
          <h3>Proposal for {lead ? lead.name : ""}</h3>
          <div className="t-meta">
            {lead ? lead.address : ""}, prepared by {rep ? rep.name : ""},{" "}
            {dt(estimate.createdAt)}
          </div>
        </div>
      </div>

      {estimate.customerNotes ? (
        <p className="t-meta" style={{ margin: "14px 0 0", whiteSpace: "pre-line" }}>
          {estimate.customerNotes}
        </p>
      ) : null}

      <div style={{ marginTop: 16 }}>
        {TIERS.map((tier) => {
          const lines = estimate.tiers[tier] ?? [];
          if (!lines.length) return null;
          const totals = estimateTierTotals(lines, estimate.tierMeta[tier], estimate.taxRate);
          const deposit = round2(totals.totalPrice * (estimate.depositPercent / 100));
          const selected = chosen === tier;
          const tierLabel = estimate.tierMeta[tier]?.label || tier;

          return (
            <Panel
              key={tier}
              style={{
                marginBottom: 12,
                cursor: "pointer",
                ...(selected
                  ? { borderColor: "var(--blue)", boxShadow: "var(--lift-2)" }
                  : {}),
              }}
            >
              <PanelHead>
                <div className="row" onClick={() => setChosen(tier)}>
                  <input
                    type="radio"
                    name="tier"
                    checked={selected}
                    readOnly
                    style={{ accentColor: "var(--blue)" }}
                  />
                  <h3>{tierLabel}</h3>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="money-big">{money2(totals.totalPrice)}</div>
                  <div className="t-meta">
                    {money2(deposit)} deposit ({estimate.depositPercent}%)
                  </div>
                </div>
              </PanelHead>
              <PanelBody tight>
                {estimate.tierMeta[tier]?.summary ? (
                  <p className="t-meta" style={{ margin: "0 0 10px" }}>
                    {estimate.tierMeta[tier]?.summary}
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
      </div>

      {isSigned ? (
        <Panel style={{ marginTop: 12 }}>
          <PanelBody>
            <div className="row">
              <StagePill stage="Signed" />
              <span>
                Signed by {estimate.signedByName} on {dt(estimate.signedAt, true)}
              </span>
            </div>
          </PanelBody>
        </Panel>
      ) : (
        <Panel style={{ marginTop: 16 }}>
          <PanelBody>
            <div className="label">Electronic signature</div>
            <input
              className="sign-input"
              type="text"
              placeholder="Type your full name"
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
            />
            <div className="t-meta" style={{ marginTop: 7 }}>
              Typing your name and pressing Sign constitutes acceptance of the selected option
              and authorises the deposit.
            </div>
          </PanelBody>
        </Panel>
      )}
    </Modal>
  );
}
