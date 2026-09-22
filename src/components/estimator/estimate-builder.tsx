"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { useAppStore } from "@/lib/data/hooks";
import { round2, totalsFor } from "@/lib/data/pricing";
import { money2, pct } from "@/lib/format";
import { can } from "@/lib/auth/permissions";
import { PRODUCT_CATEGORIES, TIERS } from "@/lib/constants";
import type { Database, EstimateTiers, Role, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EstimateBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  db: Database;
  role: Role;
  repId: string;
  estimateId?: string;
  leadId?: string;
}

const TIER_CLASS: Record<Tier, string> = { Good: "good", Better: "better", Best: "best" };

/**
 * The builder is shared by Admin and Sales Rep. Every cost and margin node is
 * rendered inside a `showCost` branch, so for a Sales Rep session those numbers
 * are never written into the document at all.
 */
export function EstimateBuilder({
  open,
  onOpenChange,
  db,
  role,
  repId,
  estimateId,
  leadId,
}: EstimateBuilderProps) {
  const showCost = can.viewCost(role);
  const { store, invalidate } = useAppStore();
  const { toast } = useToast();

  const existing = estimateId ? (db.estimates.find((e) => e.id === estimateId) ?? null) : null;
  const isRep = role === "Sales Rep";

  const [selectedLeadId, setSelectedLeadId] = useState(leadId ?? existing?.leadId ?? "");
  const [depositPercent, setDepositPercent] = useState(existing?.depositPercent ?? 30);
  const [activeTier, setActiveTier] = useState<Tier>("Better");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [tiers, setTiers] = useState<EstimateTiers>(() =>
    existing
      ? structuredClone(existing.tiers)
      : { Good: [], Better: [], Best: [] },
  );

  const candidates = db.leads.filter((l) => {
    if (isRep && l.assignedRepId !== repId) return false;
    return l.stage !== "Lost";
  });

  const catalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.products.filter((p) => {
      if (!p.active) return false;
      if (category && p.category !== category) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [db.products, search, category]);

  function addLine(productId: string) {
    setTiers((prev) => {
      const lines = [...prev[activeTier]];
      const index = lines.findIndex((l) => l.productId === productId);
      if (index >= 0) lines[index] = { ...lines[index], qty: lines[index].qty + 1 };
      else lines.push({ productId, qty: 1 });
      return { ...prev, [activeTier]: lines };
    });
    const product = db.products.find((p) => p.id === productId);
    toast(`${product?.name ?? "Item"} added to ${activeTier}.`, "ok", 1800);
  }

  async function collect() {
    if (!selectedLeadId) {
      toast("Pick a customer first.", "warn");
      return null;
    }
    if (!TIERS.some((t) => tiers[t].length)) {
      toast("Add at least one line item.", "warn");
      return null;
    }
    const estimate = await store.saveEstimate({
      id: existing?.id ?? null,
      leadId: selectedLeadId,
      repId,
      depositPercent,
      tiers,
    });
    invalidate();
    return estimate;
  }

  const betterTotals = totalsFor(db.products, tiers.Better);
  const depositPreview = round2(betterTotals.totalPrice * (depositPercent / 100));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Edit estimate" : "New estimate"}
      subtitle={
        "Prices shown are customer-facing" +
        (showCost
          ? ". Cost and margin are visible because you are an Admin."
          : ". Cost and margin are not part of this view.")
      }
      wide
      sticky
      actions={[
        { label: "Cancel", variant: "ghost" },
        {
          label: "Save draft",
          keep: true,
          onClick: async (close) => {
            const saved = await collect();
            if (!saved) return false;
            toast("Draft saved.", "ok");
            close();
          },
        },
        {
          label: "Send estimate",
          variant: "primary",
          keep: true,
          onClick: async (close) => {
            const saved = await collect();
            if (!saved) return false;
            await store.sendEstimate(saved.id);
            invalidate();
            toast("Estimate sent. Lead moved to Estimate Sent.", "ok");
            close();
          },
        },
      ]}
    >
      <div className="builder">
        <div>
          <div className="field-row">
            <Field label="Customer" className="grow">
              <Select
                value={selectedLeadId}
                onChange={(event) => setSelectedLeadId(event.target.value)}
              >
                <option value="">Select a customer</option>
                {candidates.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name}, {lead.zipCode}, {lead.stage}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Deposit %" style={{ flex: "0 0 140px" }}>
              <Input
                type="number"
                min={0}
                max={100}
                step={5}
                value={depositPercent}
                onChange={(event) => setDepositPercent(Number(event.target.value) || 0)}
              />
            </Field>
          </div>

          <Panel>
            <PanelHead>
              <h3>Products</h3>
              <div className="row">
                <span className="t-meta">Adding to</span>
                <Segmented options={TIERS} value={activeTier} onChange={setActiveTier} />
              </div>
            </PanelHead>
            <PanelBody tight>
              <div className="field-row" style={{ marginBottom: 10 }}>
                <div className="field grow" style={{ marginBottom: 0 }}>
                  <Input
                    type="search"
                    placeholder="Search products"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="field" style={{ flex: "0 0 165px", marginBottom: 0 }}>
                  <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="">All categories</option>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="catalog">
                {catalog.length === 0 ? (
                  <div style={{ padding: 16 }}>
                    <EmptyState
                      title="No match"
                      message="No product in the catalog matches that search."
                    />
                  </div>
                ) : (
                  catalog.map((product) => (
                    <div key={product.id} className="cat-row">
                      <div className="grow">
                        <div className="cn">{product.name}</div>
                        <div className="cm">
                          {product.category} (per {product.unit})
                          {product.tier ? `, ${product.tier}` : ""}
                        </div>
                      </div>
                      <span className="cp">{money2(product.pricePerUnit)}</span>
                      {showCost ? (
                        <span className="cp muted t-meta">
                          cost {money2(product.costPerUnit)}
                        </span>
                      ) : null}
                      <Button
                        size="sm"
                        variant="primary"
                        title={`Add to the ${activeTier} tier`}
                        onClick={() => addLine(product.id)}
                      >
                        Add
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div>
          <Panel>
            <PanelHead>
              <h3>Estimate tiers</h3>
              <span className="t-meta">Good / Better / Best</span>
            </PanelHead>
            <PanelBody tight>
              {TIERS.map((tier) => {
                const lines = tiers[tier];
                const totals = totalsFor(db.products, lines);

                return (
                  <div key={tier} className={cn("tierbox", TIER_CLASS[tier])}>
                    <header>
                      <div className="row">
                        <span className="tname">{tier}</span>
                        <span className="t-meta">
                          {lines.length} item{lines.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="row">
                        <strong className="t-num">{money2(totals.totalPrice)}</strong>
                        {showCost ? (
                          <span className="t-meta" style={{ color: "var(--moss)" }}>
                            margin {money2(totals.totalMargin)} ({pct(totals.marginPct)})
                          </span>
                        ) : null}
                      </div>
                    </header>

                    {lines.length === 0 ? (
                      <div style={{ padding: 14 }}>
                        <div className="t-meta">
                          Empty. Pick &quot;{tier}&quot; above, then add items from the catalog.
                        </div>
                      </div>
                    ) : null}

                    {lines.map((line, index) => {
                      const product = db.products.find((p) => p.id === line.productId);
                      if (!product) return null;
                      return (
                        <div key={line.productId} className="line-row">
                          <div>
                            <div>{product.name}</div>
                            <div className="t-meta">
                              {product.category}, {money2(product.pricePerUnit)} per {product.unit}
                            </div>
                          </div>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={line.qty}
                            onChange={(event) => {
                              const value = Number(event.target.value) || 0;
                              setTiers((prev) => {
                                const next = [...prev[tier]];
                                next[index] = { ...next[index], qty: value };
                                return { ...prev, [tier]: next };
                              });
                            }}
                          />
                          <div className="lp t-num">{money2(product.pricePerUnit * line.qty)}</div>
                          <button
                            type="button"
                            className="x-btn"
                            title="Remove"
                            onClick={() =>
                              setTiers((prev) => ({
                                ...prev,
                                [tier]: prev[tier].filter((_, i) => i !== index),
                              }))
                            }
                          >
                            &times;
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <div className="t-meta" style={{ marginTop: 12 }}>
                Deposit on the Better tier at {depositPercent}% would be{" "}
                {money2(depositPreview)}.
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </Modal>
  );
}
