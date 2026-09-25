/* ==========================================================================
   pricing.ts  -  money math
   Cost and margin are always derived from the product catalog and the
   quantity, never stored as an editable value on an estimate or an invoice.
   ========================================================================== */

import { round2 } from "../format";
import type {
  EstimateLine,
  EstimateLineRow,
  EstimateTierMeta,
  EstimateTierTotals,
  LineItem,
  PricedLine,
  Product,
  Totals,
} from "../types";

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
/* ------------------------------------------------------ estimate packages */

/**
 * Prices one estimate line from its own snapshot (name/unit/price/cost),
 * never by re-joining the catalog - that is what makes a custom, non-catalog
 * line (a fee, a discount line, anything typed by hand) work the same way as
 * a catalog line.
 */
export function priceEstimateLine(line: EstimateLine): EstimateLineRow {
  const linePrice = round2(line.unitPrice * line.qty);
  const lineCost = round2(line.unitCost * line.qty);
  return {
    id: line.id,
    productId: line.productId,
    name: line.name,
    description: line.description,
    unit: line.unit,
    qty: line.qty,
    unitPrice: line.unitPrice,
    unitCost: line.unitCost,
    linePrice,
    lineCost,
    isCustom: line.isCustom,
  };
}

/**
 * One Good/Better/Best package's totals: line subtotal, the package-level
 * discount taken off the customer-facing price (cost is untouched by a
 * discount - it still reflects what the job actually costs), sales tax on the
 * taxable lines, and margin. The discount is spread across lines in
 * proportion to their price, so only its taxable share reduces the tax base.
 * Tax is passed through to the state, so margin is measured before tax.
 */
export function estimateTierTotals(
  lines: readonly EstimateLine[] | undefined,
  meta: EstimateTierMeta | undefined,
  taxRate: number = 0,
): EstimateTierTotals {
  const rows = (lines ?? []).map(priceEstimateLine);

  let subtotalPrice = 0;
  let subtotalCost = 0;
  let taxableSubtotal = 0;
  (lines ?? []).forEach((line, i) => {
    subtotalPrice += rows[i].linePrice;
    subtotalCost += rows[i].lineCost;
    if (line.taxable) taxableSubtotal += rows[i].linePrice;
  });
  subtotalPrice = round2(subtotalPrice);
  subtotalCost = round2(subtotalCost);

  let discountAmount = 0;
  if (subtotalPrice > 0) {
    const value = Number(meta?.discountValue) || 0;
    if (meta?.discountType === "percent") {
      discountAmount = round2(subtotalPrice * (Math.min(Math.max(value, 0), 100) / 100));
    } else if (meta?.discountType === "amount") {
      discountAmount = round2(Math.min(Math.max(value, 0), subtotalPrice));
    }
  }

  const netPrice = round2(subtotalPrice - discountAmount);
  const rate = Math.max(Number(taxRate) || 0, 0);
  const taxBase =
    subtotalPrice > 0 ? Math.max(taxableSubtotal, 0) * (netPrice / subtotalPrice) : 0;
  const taxAmount = round2(taxBase * (rate / 100));

  const totalPrice = round2(netPrice + taxAmount);
  const totalCost = subtotalCost;
  const totalMargin = round2(netPrice - totalCost);

  return {
    rows,
    subtotalPrice,
    subtotalCost,
    discountAmount,
    netPrice,
    taxAmount,
    totalPrice,
    totalCost,
    totalMargin,
    marginPct: netPrice > 0 ? round2((totalMargin / netPrice) * 100) : 0,
  };
}

/** A fresh line snapshotted from a catalog product, ready to drop into a tier. */
export function lineFromProduct(product: Product, id: string, qty = 1): EstimateLine {
  return {
    id,
    productId: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    unit: product.unit,
    qty,
    unitPrice: product.pricePerUnit,
    unitCost: product.costPerUnit,
    taxable: product.taxable,
    isCustom: false,
  };
}

/**
 * An estimate package, reduced to the old flat {productId, qty} shape an
 * Invoice still carries. A custom line (no catalog product behind it - a fee,
 * a discount line) has nothing to reduce to, so it is left out here; the
 * dollar totals on the invoice still come from estimateTierTotals(), which
 * does include it, so the amount owed is always right even though the line
 * table on the invoice itself only lists catalog items.
 */
export function toInvoiceLines(lines: readonly EstimateLine[] | undefined): LineItem[] {
  const out: LineItem[] = [];
  for (const line of lines ?? []) {
    if (!line.productId) continue;
    out.push({ productId: line.productId, qty: line.qty });
  }
  return out;
}

/** A blank custom line (a fee, a discount line, anything typed by hand). */
export function blankCustomLine(id: string): EstimateLine {
  return {
    id,
    productId: null,
    name: "",
    description: null,
    category: null,
    unit: "EA",
    qty: 1,
    unitPrice: 0,
    unitCost: 0,
    taxable: true,
    isCustom: true,
  };
}

/** A package with no rename, no pitch and no discount. */
export function blankTierMeta(): EstimateTierMeta {
  return { label: null, summary: null, discountType: null, discountValue: 0, discountReason: null };
}

/**
 * Order quantity for a product from a measured floor area in square feet,
 * with the product's waste factor added and rounded up to a whole unit. Only
 * area-priced units convert; anything else returns null so the caller keeps
 * its own default.
 */
export function qtyFromArea(product: Product, areaSqFt: number): number | null {
  if (!(areaSqFt > 0)) return null;
  const withWaste = areaSqFt * (1 + (product.wasteFactor ?? 0));
  if (product.unit === "SF") return Math.ceil(withWaste);
  if (product.unit === "YD") return Math.ceil(withWaste / 9);
  return null;
}

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
