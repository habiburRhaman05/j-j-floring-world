/* ==========================================================================
   pricing.ts  -  money math
   Cost and margin are always derived from the product catalog and the
   quantity, never stored as an editable value on an estimate or an invoice.
   ========================================================================== */

import { round2 } from "../format";
import type { LineItem, PricedLine, Product, Totals } from "../types";

export { round2 };

export function byId<T extends { id: string }>(
  arr: readonly T[] | undefined,
  id: string | null | undefined,
): T | null {
  if (!arr || !id) return null;
  for (const item of arr) if (item.id === id) return item;
  return null;
}

/** Join a list of line items against the catalog, dropping any orphan. */
export function priceLines(
  products: readonly Product[],
  lines: readonly LineItem[] | undefined,
): PricedLine[] {
  const out: PricedLine[] = [];
  for (const line of lines ?? []) {
    const p = byId(products, line.productId);
    if (!p) continue;
    out.push({
      productId: p.id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      qty: line.qty,
      pricePerUnit: p.pricePerUnit,
      costPerUnit: p.costPerUnit,
      linePrice: round2(p.pricePerUnit * line.qty),
      lineCost: round2(p.costPerUnit * line.qty),
    });
  }
  return out;
}

export function totalsFor(
  products: readonly Product[],
  lines: readonly LineItem[] | undefined,
): Totals {
  const rows = priceLines(products, lines);
  let price = 0;
  let cost = 0;
  for (const r of rows) {
    price += r.linePrice;
    cost += r.lineCost;
  }
  price = round2(price);
  cost = round2(cost);
  return {
    rows,
    totalPrice: price,
    totalCost: cost,
    totalMargin: round2(price - cost),
    marginPct: price > 0 ? round2(((price - cost) / price) * 100) : 0,
  };
}

/**
 * A blank rate is meaningful: it means "pay whatever the rep's rate is",
 * which is not the same as a rate of zero.
 */
export function normaliseRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/**
 * The commission a single line earns: the product's own rate when it carries
 * one, otherwise the rep's rate, otherwise the company default. Every figure
 * in the app is derived through this chain.
 */
export function commissionRateFor(
  product: Product | null,
  repRate: number,
  defaultRate: number,
): number {
  if (product && product.commissionRate !== null) return product.commissionRate;
  return repRate || defaultRate;
}
