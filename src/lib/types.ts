/* ==========================================================================
   types.ts  -  the domain model
   Every entity the workspace reads or writes is described here. These types
   are the contract the whole UI is built against; when the real API lands it
   only has to return shapes that satisfy them.
   ========================================================================== */

import type {
  CSR_STAGES,
  JOB_STAGES,
  LEAD_SOURCES,
  PRODUCT_CATEGORIES,
  SALES_STAGES,
  TIERS,
  UNITS,
} from "./constants";

export type Role = "Admin" | "Sales Rep" | "CSR" | "Installer";

export type Unit = (typeof UNITS)[number];
export type Tier = (typeof TIERS)[number];
export type LeadSource = (typeof LEAD_SOURCES)[number];
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type SalesStage = (typeof SALES_STAGES)[number];
export type CsrStage = (typeof CSR_STAGES)[number];
export type LeadStage = SalesStage;
export type JobStage = (typeof JOB_STAGES)[number];

export type EstimateStatus = "Draft" | "Sent" | "Viewed" | "Signed" | "Expired";
export type PaymentStatus = "Unpaid" | "Partial" | "Paid";
export type SyncDirection = "in" | "out";

export interface User {
  id: string;
  name: string;
  /** Sign-in identity. Unique across the team, matched case-insensitively. */
  email: string;
  role: Role;
  /** 0.06 means six percent. */
  commissionRate: number;
}

export interface Product {
  id: string;
  name: string;
  /** Internal stock code, e.g. "CPT-BER-4200". Optional. */
  sku: string | null;
  /** Spec detail shown to the customer on the estimate (fiber, finish, warranty class). */
  description: string | null;
  category: ProductCategory;
  unit: Unit;
  costPerUnit: number;
  pricePerUnit: number;
  /** Good / Better / Best marker, or null for job lines with no tier. */
  tier: Tier | null;
  /** null means "pay the rep's standard rate". Never the same as a zero rate. */
  commissionRate: number | null;
  /** Waste factor applied when quantity is derived from a measured area, e.g. 0.1 = 10%. */
  wasteFactor: number | null;
  /** Whether tax applies to this line when it appears on an estimate/invoice. */
  taxable: boolean;
  active: boolean;
}

export interface LeadNote {
  at: string;
  by: string;
  text: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  zipCode: string;
  address: string;
  source: LeadSource;
  assignedRepId: string;
  stage: LeadStage;
  createdAt: string;
  appointmentAt: string | null;
  notes: LeadNote[];
}

export interface LineItem {
  productId: string;
  qty: number;
}

/**
 * One line inside a single Good/Better/Best package. Name, unit, price and
 * cost are snapshotted at the moment the line is added (or typed, for a
 * custom line) rather than always re-read from the product catalog, so a
 * later catalog price change never silently reshapes an estimate someone is
 * still building, and a discount, fee, or scope-only line that has no
 * catalog product at all (productId null) fits the exact same shape.
 */
export interface EstimateLine {
  /** Stable client-side id, so a line can be edited/removed without index bugs. */
  id: string;
  /** The catalog product this line was added from, or null for a free-text line. */
  productId: string | null;
  name: string;
  /** Extra spec/scope detail shown on the line, e.g. "60 oz, stain-resist". */
  description: string | null;
  category: ProductCategory | null;
  unit: Unit;
  qty: number;
  unitPrice: number;
  unitCost: number;
  taxable: boolean;
  /** True for a fee, credit, discount line, or anything not drawn from the price book. */
  isCustom: boolean;
  /** The GoHighLevel product and price this line was added from. */
  ghlProductId?: string | null;
  ghlPriceId?: string | null;
}

/** Discount applied to one whole package, on top of its line items. */
export type DiscountType = "percent" | "amount";

/**
 * Everything about ONE Good/Better/Best package besides its line items: the
 * name the customer sees for it (a rep can rename "Better" to "Most Popular"),
 * the pitch, and any discount given on the package as a whole. A service or
 * delivery fee is not a separate field here - it is just another line with
 * isCustom true, exactly like a discount line with a negative price would be.
 */
export interface EstimateTierMeta {
  /** Override for the customer-facing package name. Null keeps "Good"/"Better"/"Best". */
  label: string | null;
  /** Short "what's included" pitch shown above the line items on this package. */
  summary: string | null;
  discountType: DiscountType | null;
  discountValue: number;
  /** Why the discount was given, kept for the record, never shown to the customer. */
  discountReason: string | null;
}

export interface EstimateTiers {
  Good: EstimateLine[];
  Better: EstimateLine[];
  Best: EstimateLine[];
}

export interface Estimate {
  id: string;
  /** Human-facing number, e.g. "EST-2026-0142". */
  number: string;
  leadId: string;
  repId: string;
  createdAt: string;
  status: EstimateStatus;
  signedAt: string | null;
  signedByName: string | null;
  depositPercent: number;
  acceptedTier: Tier | null;
  tiers: EstimateTiers;
  tierMeta: Record<Tier, EstimateTierMeta>;
  /** Printed on the proposal the customer sees. */
  customerNotes: string | null;
  /** Never leaves the app - not sent to GHL, not shown on the sign sheet. */
  internalNotes: string | null;
  /** Sales tax in percent (7.25 = 7.25%), applied to taxable lines after discount. */
  taxRate: number;
  /** The package the GHL document was sent for (what the customer is asked to sign). */
  sentTier?: Tier | null;
  /** The customer the estimate is for, as held on the lead. */
  customer?: { name: string; email: string; phone: string } | null;
}

export interface JobPhoto {
  id: string;
  label: string;
  name: string;
  at: string;
}

export interface Job {
  id: string;
  leadId: string;
  estimateId: string;
  stage: JobStage;
  scheduledDate: string | null;
  installerId: string | null;
  materialsReceived: boolean;
  photos: JobPhoto[];
  completedAt: string | null;
  adminConfirmedAt: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  jobId: string;
  estimateId: string;
  leadId: string;
  repId: string;
  tier: Tier;
  lineItems: LineItem[];
  totalPrice: number;
  totalCost: number;
  totalMargin: number;
  depositPercent: number;
  depositAmount: number;
  depositPaid: boolean;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
}

export interface SyncEntry {
  id: string;
  at: string;
  dir: SyncDirection;
  event: string;
  message: string;
  payload?: unknown;
}

/* ---------------------------------------------------------------- derived */

/** A line item joined against the product catalog. Cost is derived, never stored. */
export interface PricedLine {
  productId: string;
  name: string;
  category: ProductCategory;
  unit: Unit;
  qty: number;
  pricePerUnit: number;
  costPerUnit: number;
  linePrice: number;
  lineCost: number;
}

export interface Totals {
  rows: PricedLine[];
  totalPrice: number;
  totalCost: number;
  totalMargin: number;
  marginPct: number;
}

/** One estimate line, priced. Kept separate from PricedLine because a custom
 *  line has no product to join against - the line snapshot IS the price. */
export interface EstimateLineRow {
  id: string;
  productId: string | null;
  name: string;
  description: string | null;
  unit: Unit;
  qty: number;
  unitPrice: number;
  unitCost: number;
  linePrice: number;
  lineCost: number;
  isCustom: boolean;
}

/** One Good/Better/Best package, priced: line subtotal, the discount taken
 *  off it, and the resulting customer-facing total. */
export interface EstimateTierTotals {
  rows: EstimateLineRow[];
  subtotalPrice: number;
  subtotalCost: number;
  discountAmount: number;
  /** Subtotal less discount: what margin is measured against. Excludes tax. */
  netPrice: number;
  taxAmount: number;
  /** What the customer pays: net price plus tax. */
  totalPrice: number;
  totalCost: number;
  totalMargin: number;
  marginPct: number;
}

export interface JobFinancials {
  totalPrice: number;
  totalCost: number;
  totalMargin: number;
  marginPct: number;
}

export interface CompanyTotals {
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  outstanding: number;
  collected: number;
  jobCount: number;
}

export interface RepStats {
  repId: string;
  name: string;
  dealsWon: number;
  dealsLost: number;
  openLeads: number;
  revenue: number;
  commissionRate: number;
  commission: number;
  closeRate: number;
}

export interface FunnelRow {
  label: string;
  count: number;
  tone?: "won" | "lost";
}

export interface AppSettings {
  defaultCommissionRate: number;
}

export interface Database {
  version: number;
  seededAt: string;
  settings: AppSettings;
  users: User[];
  products: Product[];
  leads: Lead[];
  estimates: Estimate[];
  jobs: Job[];
  invoices: Invoice[];
  syncLog: SyncEntry[];
}

/**
 * A signed-in session. Held in memory for this frontend-first build; when the
 * API lands the token becomes an httpOnly cookie and `token` goes away.
 */
export interface Session {
  userId: string;
  role: Role;
  email: string;
  token: string;
  at: string;
  expiresAt: string | null;
}
