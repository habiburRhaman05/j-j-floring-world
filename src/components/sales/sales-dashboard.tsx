"use client";

import { useMemo, useState } from "react";
import { PipelineBoard, PipelineBoardSkeleton } from "@/components/csr/pipeline-board";
import { InvoicesPanel } from "@/components/sales/invoices-panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { Stat, StatStrip } from "@/components/ui/stat";
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { toApiError } from "@/lib/api/errors";
import { money, pct, relative } from "@/lib/format";
import { useMoveSalesOpportunity, useSalesBoard, useSaveSalesRates } from "@/lib/sales/hooks";
import {
  RANGE_LABEL,
  computeMetrics,
  customRange,
  metricsByMonth,
  metricsByOwner,
  presetRange,
  type RangePreset,
  type SalesMetrics,
} from "@/lib/sales/metrics";
import type { SalesBoardResponse, SalesOpportunity } from "@/lib/sales/types";

/* ==========================================================================    sales-dashboard.tsx  -  the sales pipeline board, admin (everyone) or rep (own)
   --------------------------------------------------------------------------
   Filters: date range (drives every number), rep (admin), contact search
   (name/phone/email, drives everything), card status (board only - the
   board is the pipeline as it stands now).
   ========================================================================== */

type StatusFilter = "open" | "won" | "lost" | "all";
const STATUS_LABEL: Record<StatusFilter, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost / abandoned",
  all: "All statuses",
};

const ALL = "__all__";

function days(n: number | null): string {
  return n === null ? "-" : `${n} day${n === 1 ? "" : "s"}`;
}

export function SalesDashboard({ scope }: { scope: "all" | "own" }) {
  const board = useSalesBoard();
  const move = useMoveSalesOpportunity();
  const [movingIds, setMovingIds] = useState<ReadonlySet<string>>(new Set());

  const [preset, setPreset] = useState<RangePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [ownerKey, setOwnerKey] = useState(ALL);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [search, setSearch] = useState("");

  const data = board.data;
  const isAdmin = scope === "all";
  const range = useMemo(
    () => (preset === "custom" ? customRange(customFrom, customTo) : presetRange(preset)),
    [preset, customFrom, customTo],
  );

  const ownerKeyOf = (o: { ownerUserId: string | null; ownerName: string }) =>
    o.ownerUserId ? `u:${o.ownerUserId}` : `n:${o.ownerName}`;

  const query = search.trim().toLowerCase();
  const matchesSearch = (fields: (string | null | undefined)[]) =>
    !query || fields.some((f) => f?.toLowerCase().includes(query));

  /** Rep + contact filters: these apply to every number, table and the board. */
  const scoped = (data?.opportunities ?? []).filter(
    (o) =>
      (ownerKey === ALL || ownerKeyOf(o) === ownerKey) &&
      matchesSearch([o.contactName, o.name, o.email, o.phone]),
  );

  if (board.isPending) {
    return (
      <>
        <div className="skel" style={{ height: 88, marginBottom: 16 }} />
        <PipelineBoardSkeleton columns={5} />
      </>
    );
  }
  if (board.error || !data) {
    return (
      <div className="login-alert" role="alert">
        <span>{toApiError(board.error).displayMessage}</span>
      </div>
    );
  }

  const totals = computeMetrics(scoped, range, data.rates);
  const owners = metricsByOwner(
    data.opportunities.filter((o) => matchesSearch([o.contactName, o.name, o.email, o.phone])),
    data.reps,
    range,
    data.rates,
  );
  const months = metricsByMonth(scoped, range, data.rates);
  const boardCards = scoped.filter((o) =>
    status === "all" ? true : status === "lost" ? o.status === "lost" || o.status === "abandoned" : o.status === status,
  );
  const contacts = data.assignedContacts.filter(
    (c) =>
      (ownerKey === ALL || ownerKeyOf(c) === ownerKey) && matchesSearch([c.name, c.email, c.phone]),
  );
  const showMargin = data.rates.marginPercent !== null;
  const rangeLabel =
    preset === "custom"
      ? `${customFrom || "start"} to ${customTo || "today"}`
      : RANGE_LABEL[preset].toLowerCase();

  function moveCard(opportunity: SalesOpportunity, stageId: string) {
    setMovingIds((ids) => new Set(ids).add(opportunity.id));
    move.mutate(
      { opportunityId: opportunity.id, stageId },
      {
        onSettled: () =>
          setMovingIds((ids) => {
            const next = new Set(ids);
            next.delete(opportunity.id);
            return next;
          }),
      },
    );
  }

  return (
    <>
      {data.notice ? (
        <div className="login-alert" role="alert" style={{ marginBottom: 14 }}>
          <span>{data.notice}</span>
        </div>
      ) : null}

      {/* ------------------------------------------------------ filters */}
      <div className="sales-filters">
        <Field label="Date range">
          <Select value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)}>
            {(Object.keys(RANGE_LABEL) as RangePreset[]).map((key) => (
              <option key={key} value={key}>
                {RANGE_LABEL[key]}
              </option>
            ))}
          </Select>
        </Field>
        {preset === "custom" ? (
          <>
            <Field label="From">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </Field>
          </>
        ) : null}
        {isAdmin ? (
          <Field label="Sales rep">
            <Select value={ownerKey} onChange={(e) => setOwnerKey(e.target.value)}>
              <option value={ALL}>All reps</option>
              {owners.map((o) => (
                <option key={ownerKeyOf(o)} value={ownerKeyOf(o)}>
                  {o.ownerName}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Contact" className="grow">
          <Input
            type="search"
            placeholder="Name, phone or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <div className="sales-filters-end">
          <Button
            size="sm"
            variant="ghost"
            loading={board.isFetching}
            onClick={() => void board.refetch()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* --------------------------------------------------------- KPIs */}
      <StatStrip style={{ marginBottom: 16 }}>
        <Stat label="Revenue won" value={money(totals.wonValue)} note={`${totals.wonCount} won, ${rangeLabel}`} tone="good" />
        <Stat
          label="Open pipeline"
          value={money(totals.openValue)}
          note={`${totals.openCount} open deal${totals.openCount === 1 ? "" : "s"}`}
        />
        <Stat label="New leads" value={String(totals.newLeads)} note={`created ${rangeLabel}`} />
        <Stat
          label="Win rate"
          value={totals.winRate === null ? "-" : pct(totals.winRate)}
          note={`${totals.wonCount} won / ${totals.lostCount} lost`}
        />
        <Stat label="Avg deal" value={totals.avgDealSize === null ? "-" : money(totals.avgDealSize)} note={`Avg close: ${days(totals.avgDaysToClose)}`} />
        <Stat
          label={isAdmin ? "Commission owed" : "My commission"}
          value={money(totals.commission)}
          note="Based on the discount given on each won deal"
          tone="gold"
        />
        <Stat
          label="Appointment fees"
          value={money(totals.appointmentFees)}
          note={`$${data.rates.appointmentFee ?? 75} per approved estimate (${
            data.rates.appointmentFee ? Math.round(totals.appointmentFees / data.rates.appointmentFee) : 0
          } approved)`}
        />
        <Stat
          label={isAdmin ? "Total rep pay" : "My total pay"}
          value={money(totals.totalRepPay)}
          note="Commission + appointment fees"
          tone="gold"
        />
        {showMargin ? (
          <Stat
            label="Est. gross margin"
            value={money(totals.estMargin)}
            note={`${data.rates.marginPercent}% of won revenue`}
          />
        ) : null}
        {showMargin ? (
          <Stat
            label="Business keeps"
            value={money(totals.businessKeeps)}
            note="Est. margin - total rep pay"
            tone={totals.businessKeeps !== null && totals.businessKeeps >= 0 ? "good" : undefined}
          />
        ) : null}
      </StatStrip>

      {/* ------------------------------------------- per-rep performance */}
      {isAdmin ? (
        <Panel style={{ marginBottom: 16 }}>
          <PanelHead>
            <div>
              <h3>Rep performance</h3>
              <div className="t-meta">{RANGE_LABEL[preset]}. Click a rep to filter the whole page.</div>
            </div>
          </PanelHead>
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>Rep</Th>
                  <Th numeric>New</Th>
                  <Th numeric>Open</Th>
                  <Th numeric>Won</Th>
                  <Th numeric>Lost</Th>
                  <Th numeric>Win rate</Th>
                  <Th numeric>Avg deal</Th>
                  <Th numeric>Avg close</Th>
                  <Th numeric>Comm %</Th>
                  <Th numeric>Commission</Th>
                  <Th numeric>Appt fees</Th>
                  <Th numeric>Total pay</Th>
                  {showMargin ? <Th numeric>Est. margin</Th> : null}
                  {showMargin ? <Th numeric>Biz keeps</Th> : null}
                </Tr>
              </THead>
              <TBody>
                {owners.map((row) => (
                  <Tr
                    key={ownerKeyOf(row)}
                    className={ownerKey === ownerKeyOf(row) ? "row-selected" : "row-click"}
                    onClick={() => setOwnerKey(ownerKey === ownerKeyOf(row) ? ALL : ownerKeyOf(row))}
                  >
                    <Td>
                      {row.ownerName}
                      {!row.ownerUserId ? <span className="t-meta"> (not in app)</span> : null}
                    </Td>
                    <Td numeric>{row.metrics.newLeads}</Td>
                    <Td numeric>
                      {row.metrics.openCount} <span className="t-meta">{money(row.metrics.openValue)}</span>
                    </Td>
                    <Td numeric>
                      {row.metrics.wonCount} <span className="t-meta">{money(row.metrics.wonValue)}</span>
                    </Td>
                    <Td numeric>{row.metrics.lostCount}</Td>
                    <Td numeric>{row.metrics.winRate === null ? "-" : pct(row.metrics.winRate)}</Td>
                    <Td numeric>{row.metrics.avgDealSize === null ? "-" : money(row.metrics.avgDealSize)}</Td>
                    <Td numeric>{days(row.metrics.avgDaysToClose)}</Td>
                    <Td numeric>{row.ownerUserId ? `${row.commissionPercent}%` : "-"}</Td>
                    <Td numeric>{row.ownerUserId ? money(row.metrics.commission) : "-"}</Td>
                    <Td numeric>{row.ownerUserId ? money(row.metrics.appointmentFees) : "-"}</Td>
                    <Td numeric>{row.ownerUserId ? money(row.metrics.totalRepPay) : "-"}</Td>
                    {showMargin ? <Td numeric>{money(row.metrics.estMargin)}</Td> : null}
                    {showMargin ? <Td numeric>{money(row.metrics.businessKeeps)}</Td> : null}
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Panel>
      ) : null}

      {/* ------------------------------------------- open leads by stage */}
      {isAdmin ? (
        <Panel style={{ marginBottom: 16 }}>
          <PanelHead>
            <div>
              <h3>Open leads by stage</h3>
              <div className="t-meta">Open opportunities created {rangeLabel}, per rep and stage.</div>
            </div>
          </PanelHead>
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>Rep</Th>
                  {data.pipeline.stages.map((s) => (
                    <Th key={s.id} numeric>
                      {s.name}
                    </Th>
                  ))}
                </Tr>
              </THead>
              <TBody>
                {owners
                  .filter((row) => ownerKey === ALL || ownerKeyOf(row) === ownerKey)
                  .map((row) => (
                    <Tr key={ownerKeyOf(row)}>
                      <Td>{row.ownerName}</Td>
                      {data.pipeline.stages.map((s) => {
                        const cell = row.metrics.openByStage[s.id];
                        return (
                          <Td key={s.id} numeric className={cell ? undefined : "muted"}>
                            {cell ? (
                              <span title={money(cell.value)}>{cell.count}</span>
                            ) : (
                              "0"
                            )}
                          </Td>
                        );
                      })}
                    </Tr>
                  ))}
              </TBody>
            </Table>
          </TableWrap>
        </Panel>
      ) : null}

      {/* --------------------------------------------------------- board */}
      <div className="spread" style={{ margin: "4px 0 10px", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0 }}>{isAdmin ? data.pipeline.name : `My ${data.pipeline.name.toLowerCase()}`}</h3>
          <div className="t-meta">
            Live. Drag a card to change its stage; it is saved as you drop it.
          </div>
        </div>
        <Select
          aria-label="Card status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          style={{ width: "auto" }}
        >
          {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((key) => (
            <option key={key} value={key}>
              {STATUS_LABEL[key]} ({countFor(scoped, key)})
            </option>
          ))}
        </Select>
      </div>
      <PipelineBoard
        pipeline={data.pipeline}
        opportunities={boardCards}
        locationId={data.locationId}
        movingIds={movingIds}
        onMove={moveCard}
        ownerOf={isAdmin ? (o) => o.ownerName : undefined}
      />

      {/* ------------------------------------------------------ monthly */}
      <Panel style={{ marginTop: 16 }}>
        <PanelHead>
          <div>
            <h3>Month by month</h3>
            <div className="t-meta">
              {preset === "all" ? "Last 12 months." : `${RANGE_LABEL[preset]}.`} Won and lost count
              in the month they closed.
            </div>
          </div>
        </PanelHead>
        <TableWrap>
          <Table>
            <THead>
              <Tr>
                <Th>Month</Th>
                <Th numeric>New leads</Th>
                <Th numeric>Won</Th>
                <Th numeric>Revenue</Th>
                <Th numeric>Lost</Th>
                <Th numeric>Win rate</Th>
                <Th numeric>Commission</Th>
                <Th numeric>Total pay</Th>
                {showMargin ? <Th numeric>Est. margin</Th> : null}
                {showMargin ? <Th numeric>Biz keeps</Th> : null}
              </Tr>
            </THead>
            <TBody>
              {months.map((row) => (
                <MonthLine key={row.key} label={row.label} m={row.metrics} showMargin={showMargin} />
              ))}
              <MonthLine label="Total" m={totals} showMargin={showMargin} strong />
            </TBody>
          </Table>
        </TableWrap>
      </Panel>

      {/* ------------------------------------- assigned, not on the board */}
      <Panel style={{ marginTop: 16 }}>
        <PanelHead>
          <div>
            <h3>{isAdmin ? "Assigned contacts without an opportunity" : "My contacts without an opportunity"}</h3>
            <div className="t-meta">
              Assigned to {isAdmin ? "a rep" : "you"} but not in the {data.pipeline.name} yet.
            </div>
          </div>
          <span className="t-meta">{contacts.length}</span>
        </PanelHead>
        {contacts.length === 0 ? (
          <PanelBody>
            <div className="t-meta">None.</div>
          </PanelBody>
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>Contact</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  {isAdmin ? <Th>Assigned to</Th> : null}
                  <Th>Tags</Th>
                  <Th>Added</Th>
                </Tr>
              </THead>
              <TBody>
                {contacts.map((c) => (
                  <Tr key={c.id}>
                    <Td>{c.name}</Td>
                    <Td>{c.phone || "-"}</Td>
                    <Td>{c.email || "-"}</Td>
                    {isAdmin ? <Td>{c.ownerName}</Td> : null}
                    <Td>
                      {c.tags.length
                        ? c.tags.map((t) => (
                            <Pill key={t} className="pill-outline">
                              {t}
                            </Pill>
                          ))
                        : "-"}
                    </Td>
                    <Td>{c.dateAdded ? relative(c.dateAdded) : "-"}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Panel>

      <InvoicesPanel isAdmin={isAdmin} />

      {isAdmin ? <RatesPanel data={data} /> : null}

      {data.opportunities.length === 0 && !data.notice ? (
        <div style={{ marginTop: 16 }}>
          <EmptyState
            title="No opportunities yet"
            message={`The ${data.pipeline.name} has no ${isAdmin ? "" : "assigned "}opportunities right now.`}
          />
        </div>
      ) : null}
    </>
  );
}

function countFor(list: readonly SalesOpportunity[], status: StatusFilter): number {
  if (status === "all") return list.length;
  if (status === "lost") return list.filter((o) => o.status === "lost" || o.status === "abandoned").length;
  return list.filter((o) => o.status === status).length;
}

function MonthLine({
  label,
  m,
  showMargin,
  strong,
}: {
  label: string;
  m: SalesMetrics;
  showMargin: boolean;
  strong?: boolean;
}) {
  return (
    <Tr className={strong ? "row-total" : undefined}>
      <Td>{label}</Td>
      <Td numeric>{m.newLeads}</Td>
      <Td numeric>{m.wonCount}</Td>
      <Td numeric>{money(m.wonValue)}</Td>
      <Td numeric>{m.lostCount}</Td>
      <Td numeric>{m.winRate === null ? "-" : pct(m.winRate)}</Td>
      <Td numeric>{money(m.commission)}</Td>
      <Td numeric>{money(m.totalRepPay)}</Td>
      {showMargin ? <Td numeric>{money(m.estMargin)}</Td> : null}
      {showMargin ? <Td numeric>{money(m.businessKeeps)}</Td> : null}
    </Tr>
  );
}

/** Admin: the discount-based commission tiers, appointment fee and average gross margin. */
function RatesPanel({ data }: { data: SalesBoardResponse }) {
  const save = useSaveSalesRates();
  const [marginPct, setMarginPct] = useState(String(data.rates.marginPercent ?? 35));
  const [apptFee, setApptFee] = useState(String(data.rates.appointmentFee ?? 75));

  const defaultTiers = data.rates.commissionTiers ?? [];
  const [tiers, setTiers] = useState(() =>
    defaultTiers.map((t) => ({
      maxDiscount: t.maxDiscountPercent === null ? "" : String(t.maxDiscountPercent),
      commission: String(t.commissionPercent),
    })),
  );

  const updateTier = (idx: number, field: "maxDiscount" | "commission", val: string) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: val } : t)));
  };

  const addTier = () => setTiers((prev) => [...prev, { maxDiscount: "", commission: "" }]);
  const removeTier = (idx: number) => setTiers((prev) => prev.filter((_, i) => i !== idx));

  const buildTiers = () =>
    tiers
      .filter((t) => t.commission.trim() !== "")
      .map((t) => ({
        maxDiscountPercent: t.maxDiscount.trim() === "" ? null : Number(t.maxDiscount) || 0,
        commissionPercent: Number(t.commission) || 0,
      }));

  return (
    <Panel style={{ marginTop: 16 }}>
      <PanelHead>
        <div>
          <h3>Commission and margin</h3>
          <div className="t-meta">
            Every rep earns the same: commission depends only on the discount given on the signed
            estimate. The pipeline stores only the sale value, so margin uses your average gross margin.
          </div>
        </div>
      </PanelHead>
      <PanelBody>
        <div className="field-row">
          <Field label="Average gross margin %">
            <Input type="number" min={0} max={100} step={1} value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
          </Field>
          <Field label="Appointment fee ($)">
            <Input type="number" min={0} step={5} value={apptFee} onChange={(e) => setApptFee(e.target.value)} />
          </Field>
        </div>
        <div style={{ marginTop: 16, marginBottom: 12 }}>
          <h4 style={{ margin: "0 0 4px" }}>Commission tiers by discount %</h4>
          <div className="t-meta" style={{ marginBottom: 8 }}>
            A deal pays the first tier whose max discount covers the discount given. Leave
            &ldquo;Max discount&rdquo; blank for the final catch-all tier (over the last limit needs
            owner approval, so 0%).
          </div>
          <table className="product-variants-table" style={{ marginBottom: 8 }}>
            <thead>
              <tr>
                <th>Max discount %</th>
                <th>Commission %</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {tiers.map((t, i) => (
                <tr key={i}>
                  <td>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      placeholder="No limit"
                      value={t.maxDiscount}
                      onChange={(e) => updateTier(i, "maxDiscount", e.target.value)}
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={t.commission}
                      onChange={(e) => updateTier(i, "commission", e.target.value)}
                    />
                  </td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => removeTier(i)}>
                      &times;
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button size="sm" variant="ghost" onClick={addTier}>
            + Add tier
          </Button>
        </div>

        <Button
          variant="primary"
          size="sm"
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              marginPercent: Number(marginPct) || 0,
              appointmentFee: Number(apptFee) || 0,
              commissionTiers: buildTiers(),
            })
          }
        >
          Save rates
        </Button>
      </PanelBody>
    </Panel>
  );
}
