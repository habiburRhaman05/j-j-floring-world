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
  category: ProductCategory;
  unit: Unit;
  costPerUnit: number;
  pricePerUnit: number;
  /** Good / Better / Best marker, or null for job lines with no tier. */
  tier: Tier | null;
  /** null means "pay the rep's standard rate". Never the same as a zero rate. */
  commissionRate: number | null;
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

export interface EstimateTiers {
  Good: LineItem[];
  Better: LineItem[];
  Best: LineItem[];
}

export interface Estimate {
  id: string;
  leadId: string;
  repId: string;
  createdAt: string;
  status: EstimateStatus;
  signedAt: string | null;
  signedByName: string | null;
  depositPercent: number;
  acceptedTier: Tier | null;
  tiers: EstimateTiers;
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
