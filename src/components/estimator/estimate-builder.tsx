"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { SendEstimateDialog } from "@/components/estimator/send-estimate-dialog";
import { useAppStore } from "@/lib/data/hooks";
import { useSalesBoard } from "@/lib/sales/hooks";
import {
  blankCustomLine,
  blankTierMeta,
  estimateTierTotals,
  lineFromPriceBook,
  round2,
} from "@/lib/data/pricing";
import { toApiError } from "@/lib/api/errors";
import { money2, pct } from "@/lib/format";
import { can } from "@/lib/auth/permissions";
import { TIERS, UNITS } from "@/lib/constants";
import { usePriceBook } from "@/lib/pricebook/hooks";
import type { PriceBookItem } from "@/lib/pricebook/types";
import type {
  Database,
  DiscountType,
  Estimate,
  EstimateLine,
  EstimateTierMeta,
  EstimateTiers,
  Role,
  Tier,
  Unit,
} from "@/lib/types";
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

const TIER_CLASS: Record<Tier, string> = {
  Good: "good",
  Better: "better",
  Best: "best",
};

/**
 * Services, fees and extras a flooring job usually needs but that do not live
 * in the price book. Each one drops in as an editable custom line, so the rep
 * can change the price or wording on the spot. `perArea` lines take their
 * quantity from the measured area when one is entered.
 */
interface ExtraPreset {
  name: string;
  description: string | null;
  unit: Unit;
  unitPrice: number;
  taxable: boolean;
  perArea?: boolean;
}

const EXTRAS: readonly ExtraPreset[] = [
  {
    name: "Service / trip fee",
    description: "Site visit and travel",
    unit: "EA",
    unitPrice: 95,
    taxable: false,
  },
  {
    name: "Old flooring removal & haul-away",
    description: null,
    unit: "SF",
    unitPrice: 1.25,
    taxable: false,
    perArea: true,
  },
  {
    name: "Subfloor prep & leveling",
    description: null,
    unit: "SF",
    unitPrice: 1.5,
    taxable: false,
    perArea: true,
  },
  {
    name: "Furniture moving",
    description: "Per room",
    unit: "EA",
    unitPrice: 60,
    taxable: false,
  },
  {
    name: "Stair installation",
    description: "Per step",
    unit: "EA",
    unitPrice: 45,
    taxable: false,
  },
  {
    name: "Baseboard / quarter round",
    description: null,
    unit: "LF",
    unitPrice: 3.5,
    taxable: true,
  },
  {
    name: "Material delivery",
    description: null,
    unit: "EA",
    unitPrice: 75,
    taxable: false,
  },
  {
    name: "Rush / after-hours install",
    description: null,
    unit: "EA",
    unitPrice: 150,
    taxable: false,
  },
];

function newLineId(): string {
  return `ln_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function emptyMeta(): Record<Tier, EstimateTierMeta> {
  return {
    Good: blankTierMeta(),
    Better: blankTierMeta(),
    Best: blankTierMeta(),
  };
}

/**
 * The builder is shared by Admin and Sales Rep. Every cost and margin node is
 * rendered inside a `showCost` branch, so for a Sales Rep session those numbers
 * are never written into the document at all.
 *
 * Each estimate always carries three complete packages (Good / Better / Best).
 * A package is its own proposal: its own customer-facing name and pitch, its
 * own lines (catalog products plus services, fees and custom lines, each with
 * an editable price), and its own discount. Tax, deposit and notes apply to
 * the whole estimate.
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

  const existing = estimateId
    ? (db.estimates.find((e) => e.id === estimateId) ?? null)
    : null;
  const isRep = role === "Sales Rep";

  const [selectedLeadId, setSelectedLeadId] = useState(
    leadId ?? existing?.leadId ?? "",
  );
  const [depositPercent, setDepositPercent] = useState(
    String(existing?.depositPercent ?? 30),
  );
  const [taxRate, setTaxRate] = useState(String(existing?.taxRate ?? 0));
  const [area, setArea] = useState("");
  const [activeTier, setActiveTier] = useState<Tier>("Better");
  const [search, setSearch] = useState("");
  // Extra flooring ordered over the measured area, to cover cuts and waste.
  const [wastePercent, setWastePercent] = useState("10");
  const [tiers, setTiers] = useState<EstimateTiers>(() =>
    existing
      ? structuredClone(existing.tiers)
      : { Good: [], Better: [], Best: [] },
  );
  const [tierMeta, setTierMeta] = useState<Record<Tier, EstimateTierMeta>>(
    () =>
      existing?.tierMeta ? structuredClone(existing.tierMeta) : emptyMeta(),
  );
  const [customerNotes, setCustomerNotes] = useState(
    existing?.customerNotes ?? "",
  );
  const [internalNotes, setInternalNotes] = useState(
    existing?.internalNotes ?? "",
  );
  /** The saved estimate waiting on the "email it to the customer" confirmation. */
  const [sendTarget, setSendTarget] = useState<Estimate | null>(null);

  const areaValue = Number(area) || 0;
  const taxValue = Math.max(Number(taxRate) || 0, 0);
  const depositValue = Math.min(Math.max(Number(depositPercent) || 0, 0), 100);

  // Customers come live from GoHighLevel, the same data as the Sales Pipeline
  // (already limited to the rep's own deals and contacts on the server). Any
  // workspace lead the GHL list does not cover is kept, so an estimate opened
  // for an older lead still shows its customer.
  const salesBoard = useSalesBoard();
  const candidates = useMemo(() => {
    const out = new Map<string, { id: string; label: string }>();
    const board = salesBoard.data;
    if (board) {
      const stageName = new Map(
        board.pipeline.stages.map((s) => [s.id, s.name] as const),
      );
      for (const o of board.opportunities) {
        if (
          !o.contactId ||
          o.status === "lost" ||
          o.status === "abandoned" ||
          out.has(o.contactId)
        )
          continue;
        const detail = [
          o.phone || o.email,
          stageName.get(o.stageId),
          isRep ? null : o.ownerName,
        ];
        out.set(o.contactId, {
          id: o.contactId,
          label: [o.contactName, ...detail].filter(Boolean).join(" · "),
        });
      }
      for (const c of board.assignedContacts) {
        if (out.has(c.id)) continue;
        const detail = [
          c.phone || c.email,
          "no opportunity yet",
          isRep ? null : c.ownerName,
        ];
        out.set(c.id, {
          id: c.id,
          label: [c.name, ...detail].filter(Boolean).join(" · "),
        });
      }
    }
    for (const l of db.leads) {
      if (out.has(l.id) || l.stage === "Lost") continue;
      if (isRep && l.assignedRepId && l.assignedRepId !== repId) continue;
      out.set(l.id, {
        id: l.id,
        label: [l.name, l.zipCode, l.stage].filter(Boolean).join(" · "),
      });
    }
    return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [salesBoard.data, db.leads, isRep, repId]);

  // The price book is GoHighLevel's Payments > Products, read live.
  const priceBook = usePriceBook();
  const catalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (priceBook.data?.products ?? []).filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.priceLabel ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [priceBook.data, search]);

  const totalsByTier = {
    Good: estimateTierTotals(tiers.Good, tierMeta.Good, taxValue),
    Better: estimateTierTotals(tiers.Better, tierMeta.Better, taxValue),
    Best: estimateTierTotals(tiers.Best, tierMeta.Best, taxValue),
  };

  const tierName = (tier: Tier) => tierMeta[tier].label?.trim() || tier;

  /* ------------------------------------------------------------ mutations */

  function updateLines(
    tier: Tier,
    update: (lines: EstimateLine[]) => EstimateLine[],
  ) {
    setTiers((prev) => ({ ...prev, [tier]: update(prev[tier]) }));
  }

  function updateLine(tier: Tier, id: string, patch: Partial<EstimateLine>) {
    updateLines(tier, (lines) =>
      lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }

  function updateMeta(tier: Tier, patch: Partial<EstimateTierMeta>) {
    setTierMeta((prev) => ({ ...prev, [tier]: { ...prev[tier], ...patch } }));
  }

  function addProduct(item: PriceBookItem, targets: readonly Tier[]) {
    // Priced by area (SF, YD): quantity comes from the measured area plus waste.
    const waste = Math.max(Number(wastePercent) || 0, 0) / 100;
    const areaQty =
      areaValue > 0 && item.unit === "SF"
        ? Math.ceil(areaValue * (1 + waste))
        : areaValue > 0 && item.unit === "YD"
          ? Math.ceil((areaValue * (1 + waste)) / 9)
          : null;
    setTiers((prev) => {
      const next = { ...prev };
      for (const tier of targets) {
        const lines = [...prev[tier]];
        const index = lines.findIndex((l) => l.ghlPriceId === item.priceId);
        if (index >= 0) {
          lines[index] = {
            ...lines[index],
            qty: areaQty ?? lines[index].qty + 1,
          };
        } else {
          lines.push(lineFromPriceBook(item, newLineId(), areaQty ?? 1));
        }
        next[tier] = lines;
      }
      return next;
    });
    const where =
      targets.length === TIERS.length ? "all packages" : tierName(targets[0]);
    toast(
      `${item.name} added to ${where}${areaQty ? ` (${areaQty} ${item.unit} incl. waste)` : ""}.`,
      "ok",
      1800,
    );
  }

  function addExtra(preset: ExtraPreset | null) {
    const line: EstimateLine = preset
      ? {
          ...blankCustomLine(newLineId()),
          name: preset.name,
          description: preset.description,
          unit: preset.unit,
          unitPrice: preset.unitPrice,
          taxable: preset.taxable,
          qty: preset.perArea && areaValue > 0 ? Math.ceil(areaValue) : 1,
        }
      : blankCustomLine(newLineId());
    updateLines(activeTier, (lines) => [...lines, line]);
    if (preset)
      toast(`${preset.name} added to ${tierName(activeTier)}.`, "ok", 1600);
  }

  function moveLine(tier: Tier, id: string, delta: -1 | 1) {
    updateLines(tier, (lines) => {
      const i = lines.findIndex((l) => l.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= lines.length) return lines;
      const next = [...lines];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function copyPackage(from: Tier, to: Tier) {
    const source = tiers[from];
    if (!source.length) {
      toast(`${tierName(from)} has no lines to copy.`, "warn");
      return;
    }
    if (
      tiers[to].length &&
      !window.confirm(
        `Replace the ${tiers[to].length} line(s) in ${tierName(to)} with a copy of ${tierName(from)}?`,
      )
    ) {
      return;
    }
    updateLines(to, () => source.map((l) => ({ ...l, id: newLineId() })));
    toast(
      `Copied ${source.length} line(s) from ${tierName(from)}. Swap in the upgrades.`,
      "ok",
    );
  }

  /* ----------------------------------------------------------------- save */

  async function collect() {
    if (!selectedLeadId) {
      toast("Pick a customer first.", "warn");
      return null;
    }
    if (!TIERS.some((t) => tiers[t].length)) {
      toast("Add at least one line item.", "warn");
      return null;
    }
    for (const tier of TIERS) {
      if (tiers[tier].some((l) => !l.name.trim())) {
        setActiveTier(tier);
        toast(`A line in ${tierName(tier)} has no name.`, "warn");
        return null;
      }
    }
    const estimate = await store.saveEstimate({
      id: existing?.id ?? null,
      leadId: selectedLeadId,
      repId,
      depositPercent: depositValue,
      taxRate: taxValue,
      tiers,
      tierMeta: {
        Good: cleanMeta(tierMeta.Good),
        Better: cleanMeta(tierMeta.Better),
        Best: cleanMeta(tierMeta.Best),
      },
      customerNotes: customerNotes.trim() || null,
      internalNotes: internalNotes.trim() || null,
    });
    invalidate();
    return estimate;
  }

  const lines = tiers[activeTier];
  const meta = tierMeta[activeTier];
  const totals = totalsByTier[activeTier];
  const deposit = round2(totals.totalPrice * (depositValue / 100));

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={
          existing
            ? `Edit estimate ${existing.number ?? ""}`.trim()
            : "New estimate"
        }
        subtitle={
          "Build three complete packages for the customer to choose from" +
          (showCost
            ? ". Cost and margin are visible because you are an Admin."
            : ". Prices shown are customer-facing.")
        }
        wide
        className="xwide"
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
            onClick: async () => {
              const saved = await collect();
              if (!saved) return false;
              // Saved as a Draft; nothing goes to the customer until they confirm in the next step.
              setSendTarget(saved);
              return false;
            },
          },
        ]}
      >
        <div className="builder">
          {/* ------------------------------------------------ left: inputs */}
          <div>
            <Panel style={{ marginBottom: 12 }}>
              <PanelHead>
                <h3>Job details</h3>
              </PanelHead>
              <PanelBody tight>
                <Field label="Customer">
                  <Select
                    value={selectedLeadId}
                    disabled={salesBoard.isPending && candidates.length === 0}
                    onChange={(event) => setSelectedLeadId(event.target.value)}
                  >
                    <option value="">
                      {salesBoard.isPending
                        ? "Loading customers from GoHighLevel…"
                        : candidates.length
                          ? "Select a customer"
                          : "No customers found"}
                    </option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                  {salesBoard.error ? (
                    <span className="field-err">
                      Couldn&apos;t load customers from GoHighLevel:{" "}
                      {toApiError(salesBoard.error).displayMessage}
                    </span>
                  ) : !salesBoard.isPending && candidates.length === 0 ? (
                    <span className="t-meta">
                      {isRep
                        ? "No leads or contacts are assigned to you in GoHighLevel yet."
                        : "The GoHighLevel Sales Pipeline has no open deals or assigned contacts yet."}
                    </span>
                  ) : null}
                </Field>
                <div className="field-row">
                  <Field label="Measured area (SF)">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="e.g. 850"
                      value={area}
                      onChange={(event) => setArea(event.target.value)}
                    />
                  </Field>
                  <Field label="Sales tax %">
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      step={0.01}
                      value={taxRate}
                      onChange={(event) => setTaxRate(event.target.value)}
                    />
                  </Field>
                  <Field label="Waste %">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={wastePercent}
                      onChange={(event) => setWastePercent(event.target.value)}
                    />
                  </Field>
                  <Field label="Deposit %">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={depositPercent}
                      onChange={(event) =>
                        setDepositPercent(event.target.value)
                      }
                    />
                  </Field>
                </div>
                <div className="t-meta" style={{ marginTop: -6 }}>
                  With an area entered, products priced by SF or YD are added at
                  that size plus the waste allowance. Check the unit on each
                  line: GoHighLevel doesn&apos;t store one.
                </div>
              </PanelBody>
            </Panel>

            <Panel style={{ marginBottom: 12 }}>
              <PanelHead>
                <h3>Price book</h3>
                <div className="row">
                  <span className="t-meta">Adding to</span>
                  <Segmented
                    options={TIERS}
                    value={activeTier}
                    onChange={setActiveTier}
                  />
                </div>
              </PanelHead>
              <PanelBody tight>
                <div className="field-row" style={{ marginBottom: 10 }}>
                  <div className="field grow" style={{ marginBottom: 0 }}>
                    <Input
                      type="search"
                      placeholder="Search GoHighLevel products"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={priceBook.isFetching && !priceBook.isPending}
                    onClick={() => void priceBook.refetch()}
                  >
                    Refresh
                  </Button>
                </div>

                <div className="catalog">
                  {priceBook.isPending ? (
                    <div style={{ padding: 12 }}>
                      <div
                        className="skel"
                        style={{ height: 44, marginBottom: 8 }}
                      />
                      <div className="skel" style={{ height: 44 }} />
                    </div>
                  ) : priceBook.error ? (
                    <div style={{ padding: 16 }}>
                      <span className="field-err">
                        Couldn&apos;t load products from GoHighLevel:{" "}
                        {toApiError(priceBook.error).displayMessage}
                      </span>
                    </div>
                  ) : catalog.length === 0 ? (
                    <div style={{ padding: 16 }}>
                      <EmptyState
                        title={search.trim() ? "No match" : "No products yet"}
                        message={
                          search.trim()
                            ? "No GoHighLevel product matches that search."
                            : "Add products in GoHighLevel under Payments, Products, then press Refresh."
                        }
                      />
                    </div>
                  ) : (
                    catalog.map((item) => (
                      <div key={item.id} className="cat-row">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className="cat-img"
                            src={item.imageUrl}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <span
                            className="cat-img cat-img-empty"
                            aria-hidden="true"
                          />
                        )}
                        <div className="grow">
                          <div className="cn">
                            {item.name}
                            {item.priceLabel ? ` - ${item.priceLabel}` : ""}
                          </div>
                          {item.description ? (
                            <div className="cm cat-desc">
                              {item.description}
                            </div>
                          ) : null}
                        </div>
                        <span className="cp">
                          {money2(item.unitPrice)}
                          <span className="t-meta"> / {item.unit}</span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Add to all three packages"
                          onClick={() => addProduct(item, TIERS)}
                        >
                          All
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          title={`Add to ${tierName(activeTier)}`}
                          onClick={() => addProduct(item, [activeTier])}
                        >
                          Add
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHead>
                <h3>Services, fees &amp; extras</h3>
                <span className="t-meta">Adds to {tierName(activeTier)}</span>
              </PanelHead>
              <PanelBody tight>
                <div className="quick-adds">
                  {EXTRAS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className="quick-add"
                      onClick={() => addExtra(preset)}
                    >
                      <span>{preset.name}</span>
                      <span className="t-meta">
                        {money2(preset.unitPrice)}/{preset.unit}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="quick-add dashed"
                    onClick={() => addExtra(null)}
                  >
                    <span>+ Custom line</span>
                    <span className="t-meta">Anything else</span>
                  </button>
                </div>
              </PanelBody>
            </Panel>
          </div>

          {/* ---------------------------------------------- right: packages */}
          <div>
            <div className="pkg-strip">
              {TIERS.map((tier) => {
                const t = totalsByTier[tier];
                return (
                  <button
                    key={tier}
                    type="button"
                    className={cn(
                      "pkg-card",
                      TIER_CLASS[tier],
                      tier === activeTier && "active",
                    )}
                    onClick={() => setActiveTier(tier)}
                  >
                    <span className="pkg-name">{tierName(tier)}</span>
                    <span className="pkg-total">{money2(t.totalPrice)}</span>
                    <span className="t-meta">
                      {tiers[tier].length} line
                      {tiers[tier].length === 1 ? "" : "s"}
                      {showCost && t.netPrice > 0
                        ? `, ${pct(t.marginPct)} margin`
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <Panel className={cn("tierbox", TIER_CLASS[activeTier])}>
              <header>
                <div className="row grow">
                  <Input
                    className="pkg-title"
                    value={meta.label ?? ""}
                    placeholder={`${activeTier} package name`}
                    aria-label="Package name shown to the customer"
                    onChange={(event) =>
                      updateMeta(activeTier, {
                        label: event.target.value || null,
                      })
                    }
                  />
                </div>
                <div className="row">
                  <Select
                    aria-label="Copy lines from another package"
                    value=""
                    style={{ width: "auto", padding: "5px 8px", fontSize: 13 }}
                    onChange={(event) => {
                      if (event.target.value)
                        copyPackage(event.target.value as Tier, activeTier);
                    }}
                  >
                    <option value="">Copy from...</option>
                    {TIERS.filter((t) => t !== activeTier).map((t) => (
                      <option key={t} value={t}>
                        {tierName(t)}
                      </option>
                    ))}
                  </Select>
                  {lines.length ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove every line from ${tierName(activeTier)}?`,
                          )
                        ) {
                          updateLines(activeTier, () => []);
                        }
                      }}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </header>

              <div style={{ padding: "12px 12px 0" }}>
                <Textarea
                  rows={2}
                  style={{ minHeight: 0 }}
                  placeholder="What's included, shown to the customer (e.g. Premium stain-resistant carpet, 8 lb pad, lifetime install warranty)"
                  value={meta.summary ?? ""}
                  onChange={(event) =>
                    updateMeta(activeTier, {
                      summary: event.target.value || null,
                    })
                  }
                />
              </div>

              {lines.length === 0 ? (
                <div style={{ padding: 14 }}>
                  <div className="t-meta">
                    Empty. Add products from the price book, drop in services
                    and fees, or copy another package and upgrade it.
                  </div>
                </div>
              ) : (
                <div className="line-list">
                  <div
                    className={cn(
                      "line-edit line-head",
                      showCost && "with-cost",
                    )}
                  >
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Unit price</span>
                    {showCost ? <span>Unit cost</span> : null}
                    <span className="r">Total</span>
                    <span />
                  </div>
                  {lines.map((line, index) => {
                    const product = line.productId
                      ? (db.products.find((p) => p.id === line.productId) ??
                        null)
                      : null;
                    const priceChanged =
                      product && product.pricePerUnit !== line.unitPrice;
                    return (
                      <div
                        key={line.id}
                        className={cn("line-edit", showCost && "with-cost")}
                      >
                        <div className="li-main">
                          <Input
                            value={line.name}
                            placeholder="Line name"
                            aria-label="Line name"
                            onChange={(event) =>
                              updateLine(activeTier, line.id, {
                                name: event.target.value,
                              })
                            }
                          />
                          <Input
                            className="li-desc"
                            value={line.description ?? ""}
                            placeholder="Detail / spec (optional)"
                            aria-label="Line detail"
                            onChange={(event) =>
                              updateLine(activeTier, line.id, {
                                description: event.target.value || null,
                              })
                            }
                          />
                          <div className="li-flags">
                            <span
                              className={cn(
                                "li-tag",
                                line.isCustom && "custom",
                              )}
                            >
                              {line.isCustom
                                ? "Service / custom"
                                : line.ghlProductId
                                  ? "GoHighLevel product"
                                  : (line.category ?? "Product")}
                            </span>
                            <label className="check" style={{ fontSize: 12 }}>
                              <input
                                type="checkbox"
                                checked={line.taxable}
                                onChange={(event) =>
                                  updateLine(activeTier, line.id, {
                                    taxable: event.target.checked,
                                  })
                                }
                              />
                              <span>Taxable</span>
                            </label>
                            {priceChanged ? (
                              <button
                                type="button"
                                className="link-btn"
                                title="Reset to the price book price"
                                onClick={() =>
                                  updateLine(activeTier, line.id, {
                                    unitPrice: product.pricePerUnit,
                                  })
                                }
                              >
                                list {money2(product.pricePerUnit)}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="li-qty">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={line.qty}
                            aria-label="Quantity"
                            onChange={(event) =>
                              updateLine(activeTier, line.id, {
                                qty: Number(event.target.value) || 0,
                              })
                            }
                          />
                          {line.isCustom || line.ghlProductId ? (
                            <Select
                              value={line.unit}
                              aria-label="Unit"
                              onChange={(event) =>
                                updateLine(activeTier, line.id, {
                                  unit: event.target.value as Unit,
                                })
                              }
                            >
                              {UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span className="t-meta">{line.unit}</span>
                          )}
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.unitPrice}
                          aria-label="Unit price"
                          onChange={(event) =>
                            updateLine(activeTier, line.id, {
                              unitPrice: Number(event.target.value) || 0,
                            })
                          }
                        />
                        {showCost ? (
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={line.unitCost}
                            aria-label="Unit cost"
                            onChange={(event) =>
                              updateLine(activeTier, line.id, {
                                unitCost: Number(event.target.value) || 0,
                              })
                            }
                          />
                        ) : null}
                        <div className="lp t-num">
                          {money2(totals.rows[index]?.linePrice ?? 0)}
                        </div>
                        <div className="li-actions">
                          <button
                            type="button"
                            className="x-btn"
                            title="Move up"
                            disabled={index === 0}
                            onClick={() => moveLine(activeTier, line.id, -1)}
                          >
                            &uarr;
                          </button>
                          <button
                            type="button"
                            className="x-btn"
                            title="Move down"
                            disabled={index === lines.length - 1}
                            onClick={() => moveLine(activeTier, line.id, 1)}
                          >
                            &darr;
                          </button>
                          <button
                            type="button"
                            className="x-btn"
                            title="Remove"
                            onClick={() =>
                              updateLines(activeTier, (ls) =>
                                ls.filter((l) => l.id !== line.id),
                              )
                            }
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pkg-discount">
                <div className="field-row">
                  <Field label="Package discount" style={{ flex: "0 0 150px" }}>
                    <Select
                      value={meta.discountType ?? ""}
                      onChange={(event) =>
                        updateMeta(activeTier, {
                          discountType: (event.target.value ||
                            null) as DiscountType | null,
                        })
                      }
                    >
                      <option value="">No discount</option>
                      <option value="percent">% off</option>
                      <option value="amount">$ off</option>
                    </Select>
                  </Field>
                  {meta.discountType ? (
                    <>
                      <Field
                        label={
                          meta.discountType === "percent" ? "Percent" : "Amount"
                        }
                        style={{ flex: "0 0 110px" }}
                      >
                        <Input
                          type="number"
                          min={0}
                          step={meta.discountType === "percent" ? 1 : 0.01}
                          value={meta.discountValue || ""}
                          onChange={(event) =>
                            updateMeta(activeTier, {
                              discountValue: Number(event.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                      <Field label="Reason (internal only)" className="grow">
                        <Input
                          value={meta.discountReason ?? ""}
                          placeholder="e.g. Spring promo, price match, repeat customer"
                          onChange={(event) =>
                            updateMeta(activeTier, {
                              discountReason: event.target.value || null,
                            })
                          }
                        />
                      </Field>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="pkg-sum">
                <div>
                  <span>Subtotal</span>
                  <span>{money2(totals.subtotalPrice)}</span>
                </div>
                {totals.discountAmount > 0 ? (
                  <div className="save">
                    <span>
                      Discount
                      {meta.discountType === "percent"
                        ? ` (${meta.discountValue}%)`
                        : ""}
                    </span>
                    <span>-{money2(totals.discountAmount)}</span>
                  </div>
                ) : null}
                <div>
                  <span>Sales tax ({taxValue}% on taxable items)</span>
                  <span>{money2(totals.taxAmount)}</span>
                </div>
                <div className="grand">
                  <span>{tierName(activeTier)} total</span>
                  <span>{money2(totals.totalPrice)}</span>
                </div>
                <div>
                  <span>Deposit due at signing ({depositValue}%)</span>
                  <span>{money2(deposit)}</span>
                </div>
                <div>
                  <span>Balance on completion</span>
                  <span>{money2(round2(totals.totalPrice - deposit))}</span>
                </div>
                {showCost ? (
                  <div className="cost">
                    <span>
                      Cost {money2(totals.totalCost)}, margin before tax
                    </span>
                    <span
                      style={{
                        color:
                          totals.totalMargin < 0
                            ? "var(--clay)"
                            : "var(--moss)",
                      }}
                    >
                      {money2(totals.totalMargin)} ({pct(totals.marginPct)})
                    </span>
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel style={{ marginTop: 12 }}>
              <PanelHead>
                <h3>Notes</h3>
              </PanelHead>
              <PanelBody tight>
                <Field label="Notes for the customer (printed on the proposal)">
                  <Textarea
                    rows={3}
                    style={{ minHeight: 0 }}
                    placeholder="Scope, exclusions, timeline, warranty, how long the quote is valid..."
                    value={customerNotes}
                    onChange={(event) => setCustomerNotes(event.target.value)}
                  />
                </Field>
                <Field label="Internal notes (never shown to the customer)">
                  <Textarea
                    rows={2}
                    style={{ minHeight: 0 }}
                    placeholder="Access, pets, subfloor concerns, follow-up reminders..."
                    value={internalNotes}
                    onChange={(event) => setInternalNotes(event.target.value)}
                  />
                </Field>
              </PanelBody>
            </Panel>
          </div>
        </div>
      </Modal>
      {sendTarget ? (
        <SendEstimateDialog
          estimate={sendTarget}
          onClose={() => setSendTarget(null)}
          onSent={() => {
            invalidate();
            onOpenChange(false);
          }}
        />
      ) : null}
    </>
  );
}

/** Trim the free-text fields and drop a discount that takes nothing off. */
function cleanMeta(meta: EstimateTierMeta): EstimateTierMeta {
  const hasDiscount = Boolean(meta.discountType) && meta.discountValue > 0;
  return {
    label: meta.label?.trim() || null,
    summary: meta.summary?.trim() || null,
    discountType: hasDiscount ? meta.discountType : null,
    discountValue: hasDiscount ? meta.discountValue : 0,
    discountReason: hasDiscount ? meta.discountReason?.trim() || null : null,
  };
}
