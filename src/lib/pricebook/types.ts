import type { Unit } from "@/lib/types";

/**
 * One sellable price from GoHighLevel's Payments > Products. GHL is the
 * price book: a product with several prices becomes several items.
 */
export interface PriceBookItem {
  /** "<productId>:<priceId>", stable across loads. */
  id: string;
  productId: string;
  priceId: string;
  name: string;
  /** The price's own name when the product has more than one price ("Per SF", "Installed"). */
  priceLabel: string | null;
  description: string | null;
  imageUrl: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  currency: string;
  /** Read from the names/description; the rep can change it on the line. GHL has no unit field. */
  unit: Unit;
}

export interface PriceBookResponse {
  products: PriceBookItem[];
}

/** GHL has no unit of measure, so guess it from the wording and let the rep correct it. */
export function guessUnit(...texts: (string | null | undefined)[]): Unit {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (/\b(sq\.?\s?ft|sqft|square\s?f(oo|ee)t|sf)\b/.test(t)) return "SF";
  if (/\b(sq\.?\s?yds?|square\s?yards?|yards?|yds?|sy)\b/.test(t)) return "YD";
  if (/\b(lin(ear)?\.?\s?(ft|f(oo|ee)t)|lf)\b/.test(t)) return "LF";
  if (/\b(hour|hr|hourly)\b/.test(t)) return "HR";
  if (/\b(gal|gallon)\b/.test(t)) return "GAL";
  if (/\b(box|carton)\b/.test(t)) return "BOX";
  return "EA";
}
