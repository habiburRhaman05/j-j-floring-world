/* ==========================================================================
   metrics.ts  -  every sales number on the admin and rep dashboards
   --------------------------------------------------------------------------
   Pure functions over the GHL opportunities, so the admin totals, a rep's own
   view and the per-rep rows can never disagree. Which date an opportunity
   counts on depends on the question being asked:

     new leads        created in the range
     won / lost       closed (GHL's last status change) in the range
     open pipeline    still open now, created in the range

   Money:
     revenue          sum of won values
     commission       revenue x the rep's commission percent (default when unset)
     est. margin      revenue x the company's average gross margin (GHL has no cost)
   ========================================================================== */

import type { SalesOpportunity, SalesRates } from "./types";

export interface DateRange {
  /** Inclusive start, or null for "since the beginning". */
  from: Date | null;
  /** Exclusive end, or null for "until now". */
  to: Date | null;
}

export type RangePreset =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "ytd"
  | "last_12_months"
  | "all"
  | "custom";

export const RANGE_LABEL: Record<RangePreset, string> = {
  this_month: "This month",
  last_month: "Last month",
  this_quarter: "This quarter",
  ytd: "Year to date",
  last_12_months: "Last 12 months",
  all: "All time",
  custom: "Custom dates",
};

/** Local-time calendar boundaries, so "this month" means the month on the office wall. */
export function presetRange(preset: RangePreset, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "this_month":
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
    case "last_month":
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
    case "this_quarter": {
      const q = Math.floor(m / 3) * 3;
      return { from: new Date(y, q, 1), to: new Date(y, q + 3, 1) };
    }
    case "ytd":
      return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
    case "last_12_months":
      return { from: new Date(y, m - 11, 1), to: new Date(y, m + 1, 1) };
    default:
      return { from: null, to: null };
  }
}

/** "2026-09-01" style inputs to a range; the end date is included. */
export function customRange(fromInput: string, toInput: string): DateRange {
  const parse = (value: string) => {
    const [yy, mm, dd] = value.split("-").map(Number);
    return yy && mm && dd ? new Date(yy, mm - 1, dd) : null;
  };
  const from = fromInput ? parse(fromInput) : null;
  const toDay = toInput ? parse(toInput) : null;
  const to = toDay ? new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1) : null;
  return { from, to };
}

export function inRange(iso: string | null, range: DateRange): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (range.from && t < range.from.getTime()) return false;
  if (range.to && t >= range.to.getTime()) return false;
  return true;
}

const isClosedLost = (o: SalesOpportunity) => o.status === "lost" || o.status === "abandoned";

export function commissionPercentFor(userId: string | null, rates: SalesRates): number {
  if (userId && userId in rates.repCommissionPercent) return rates.repCommissionPercent[userId]!;
  return rates.defaultCommissionPercent;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SalesMetrics {
  newLeads: number;
  openCount: number;
  openValue: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  lostValue: number;
  /** won / (won + lost), 0-100; null when nothing closed. */
  winRate: number | null;
  avgDealSize: number | null;
  /** Mean days from created to won; null when nothing won. */
  avgDaysToClose: number | null;
  commission: number;
  /** null when the viewer is not shown margin. */
  estMargin: number | null;
  /** Open opportunities per stage id. */
  openByStage: Record<string, { count: number; value: number }>;
}

/**
 * Totals for a set of opportunities. Commission is worked out per deal with
 * that deal's owner's rate, so a mixed set (the company total) is still exact.
 */
export function computeMetrics(
  opportunities: readonly SalesOpportunity[],
  range: DateRange,
  rates: SalesRates,
): SalesMetrics {
  const m: SalesMetrics = {
    newLeads: 0,
    openCount: 0,
    openValue: 0,
    wonCount: 0,
    wonValue: 0,
    lostCount: 0,
    lostValue: 0,
    winRate: null,
    avgDealSize: null,
    avgDaysToClose: null,
    commission: 0,
    estMargin: rates.marginPercent === null ? null : 0,
    openByStage: {},
  };
  let daysTotal = 0;
  let daysCount = 0;

  for (const o of opportunities) {
    const createdInRange = inRange(o.createdAt, range);
    if (createdInRange) m.newLeads += 1;

    if (o.status === "open" && createdInRange) {
      m.openCount += 1;
      m.openValue += o.value;
      const stage = (m.openByStage[o.stageId] ??= { count: 0, value: 0 });
      stage.count += 1;
      stage.value += o.value;
    } else if (o.status === "won" && inRange(o.closedAt, range)) {
      m.wonCount += 1;
      m.wonValue += o.value;
      m.commission += o.value * (commissionPercentFor(o.ownerUserId, rates) / 100);
      if (o.createdAt && o.closedAt) {
        const days = (new Date(o.closedAt).getTime() - new Date(o.createdAt).getTime()) / DAY_MS;
        if (days >= 0) {
          daysTotal += days;
          daysCount += 1;
        }
      }
    } else if (isClosedLost(o) && inRange(o.closedAt, range)) {
      m.lostCount += 1;
      m.lostValue += o.value;
    }
  }

  const closed = m.wonCount + m.lostCount;
  m.winRate = closed ? round2((m.wonCount / closed) * 100) : null;
  m.avgDealSize = m.wonCount ? round2(m.wonValue / m.wonCount) : null;
  m.avgDaysToClose = daysCount ? Math.round((daysTotal / daysCount) * 10) / 10 : null;
  m.openValue = round2(m.openValue);
  m.wonValue = round2(m.wonValue);
  m.lostValue = round2(m.lostValue);
  m.commission = round2(m.commission);
  if (m.estMargin !== null && rates.marginPercent !== null) {
    m.estMargin = round2(m.wonValue * (rates.marginPercent / 100));
  }
  return m;
}

export interface OwnerRow {
  ownerUserId: string | null;
  ownerName: string;
  commissionPercent: number;
  metrics: SalesMetrics;
}

/**
 * One row per owner: every rep (even with nothing yet), plus any other owner
 * that holds cards (a GHL user not in the app, or "Unassigned").
 */
export function metricsByOwner(
  opportunities: readonly SalesOpportunity[],
  reps: readonly { userId: string; name: string }[],
  range: DateRange,
  rates: SalesRates,
): OwnerRow[] {
  const groups = new Map<string, { ownerUserId: string | null; ownerName: string; items: SalesOpportunity[] }>();
  for (const rep of reps) groups.set(`u:${rep.userId}`, { ownerUserId: rep.userId, ownerName: rep.name, items: [] });
  for (const o of opportunities) {
    const key = o.ownerUserId ? `u:${o.ownerUserId}` : `n:${o.ownerName}`;
    const group = groups.get(key) ?? { ownerUserId: o.ownerUserId, ownerName: o.ownerName, items: [] };
    group.items.push(o);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({
      ownerUserId: g.ownerUserId,
      ownerName: g.ownerName,
      commissionPercent: commissionPercentFor(g.ownerUserId, rates),
      metrics: computeMetrics(g.items, range, rates),
    }))
    .sort((a, b) => b.metrics.wonValue - a.metrics.wonValue || a.ownerName.localeCompare(b.ownerName));
}

export interface MonthRow {
  /** "2026-09" */
  key: string;
  label: string;
  metrics: SalesMetrics;
}

/**
 * Month by month across the range, newest first. "All time" is shown as the
 * last 12 months so the table stays readable.
 */
export function metricsByMonth(
  opportunities: readonly SalesOpportunity[],
  range: DateRange,
  rates: SalesRates,
  now = new Date(),
): MonthRow[] {
  const end = range.to ?? new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const start = range.from ?? new Date(end.getFullYear(), end.getMonth() - 12, 1);
  const rows: MonthRow[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  let guard = 0;
  while (cursor < end && guard++ < 120) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const month: DateRange = {
      from: cursor < start ? start : cursor,
      to: next > end ? end : next,
    };
    rows.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: cursor.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      metrics: computeMetrics(opportunities, month, rates),
    });
    cursor = next;
  }
  return rows.reverse();
}
