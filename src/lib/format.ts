/* ==========================================================================
   format.ts  -  display formatting
   One place for every money, percentage, quantity and date string the UI
   shows, so two screens can never disagree about how a number reads.
   ========================================================================== */

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const moneyFmt2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Rounded to whole dollars, for headline and stat figures. */
export function money(n: number | null | undefined): string {
  return moneyFmt.format(Number(n) || 0);
}

/** Exact to the cent, for line items and balances. */
export function money2(n: number | null | undefined): string {
  return moneyFmt2.format(Number(n) || 0);
}

export function pct(n: number | null | undefined): string {
  return `${Math.round((Number(n) || 0) * 10) / 10}%`;
}

export function qty(n: number | null | undefined): string {
  return qtyFmt.format(Number(n) || 0);
}

/** "Mar 4" or "Mar 4, 2026", optionally with a time. */
export function dt(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  if (withTime) {
    opts.hour = "numeric";
    opts.minute = "2-digit";
  }
  return d.toLocaleDateString("en-US", opts);
}

/** "just now", "12m ago", "3h ago", "5d ago", then a date. */
export function relative(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return dt(iso);
}

/** "Today", "Tomorrow", "Yesterday", then a date. */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return "Unscheduled";
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return dt(iso);
}

export function timeLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** ISO timestamp to a value a date input accepts. */
export function toInputDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** A date input value back to an ISO timestamp, or null. */
export function fromInputDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(`${v}T08:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "Janet Ross" becomes "JR". */
export function initialsOf(name: string | null | undefined): string {
  const parts = String(name || "").trim().split(/\s+/);
  const a = (parts[0] || "")[0] || "";
  const b = (parts[1] || "")[0] || "";
  return (a + b).toUpperCase() || "JJ";
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
