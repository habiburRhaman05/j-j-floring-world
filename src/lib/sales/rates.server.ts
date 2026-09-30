import "server-only";
import { prisma } from "@/lib/prisma";
import type { CommissionTier } from "./types";

/* Commission tiers, appointment fee and average margin, kept in app_settings under one key. */

const KEY = "sales.rates";

export interface StoredRates {
  marginPercent: number;
  appointmentFee: number;
  commissionTiers: CommissionTier[];
}

/** Commission depends only on the discount the rep gave: up to X% off pays Y%. Above the last tier needs owner approval. */
const DEFAULT_TIERS: CommissionTier[] = [
  { maxDiscountPercent: 0, commissionPercent: 10 },
  { maxDiscountPercent: 5, commissionPercent: 8 },
  { maxDiscountPercent: 10, commissionPercent: 6 },
  { maxDiscountPercent: 15, commissionPercent: 4 },
  { maxDiscountPercent: 20, commissionPercent: 3 },
  { maxDiscountPercent: null, commissionPercent: 0 },
];

const DEFAULTS: StoredRates = {
  marginPercent: 35,
  appointmentFee: 75,
  commissionTiers: DEFAULT_TIERS,
};

function clampPercent(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 100) : fallback;
}

function clampPositive(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseTiers(raw: unknown): CommissionTier[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_TIERS;
  const tiers = raw
    .filter(
      (t): t is { maxDiscountPercent: number | null; commissionPercent: number } =>
        typeof t === "object" && t !== null && "commissionPercent" in t,
    )
    .map((t) => ({
      maxDiscountPercent: t.maxDiscountPercent === null ? null : clampPercent(t.maxDiscountPercent, 0),
      commissionPercent: clampPercent(t.commissionPercent, 0),
    }));
  // The spreadsheet's 16/14/12/10/8 tiers were an earlier default, never the client's rule.
  if (tiers[0]?.commissionPercent === 16 && tiers[1]?.commissionPercent === 14) return DEFAULT_TIERS;
  return tiers.length ? tiers : DEFAULT_TIERS;
}

export async function readRates(): Promise<StoredRates> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  const value = (row?.value ?? {}) as Partial<StoredRates>;
  return {
    marginPercent: clampPercent(value.marginPercent, DEFAULTS.marginPercent),
    appointmentFee: clampPositive(value.appointmentFee, DEFAULTS.appointmentFee),
    commissionTiers: parseTiers(value.commissionTiers),
  };
}

export async function writeRates(rates: StoredRates, updatedById: string): Promise<StoredRates> {
  const clean: StoredRates = {
    marginPercent: clampPercent(rates.marginPercent, DEFAULTS.marginPercent),
    appointmentFee: clampPositive(rates.appointmentFee, DEFAULTS.appointmentFee),
    commissionTiers: parseTiers(rates.commissionTiers),
  };
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: {
      key: KEY,
      category: "sales",
      value: clean as object,
      description: "Discount-based commission tiers, appointment fee and average gross margin.",
      updatedById,
    },
    update: { value: clean as object, updatedById },
  });
  return clean;
}
