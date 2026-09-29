import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COMMISSION_RATE } from "@/lib/constants";

/* Commission and margin rates, kept in app_settings under one key. */

const KEY = "sales.rates";

export interface CommissionTier {
  maxDiscountPercent: number | null;
  commissionPercent: number;
}

export interface StoredRates {
  defaultCommissionPercent: number;
  marginPercent: number;
  repCommissionPercent: Record<string, number>;
  appointmentFee: number;
  commissionTiers: CommissionTier[];
}

const DEFAULT_TIERS: CommissionTier[] = [
  { maxDiscountPercent: 0, commissionPercent: 16 },
  { maxDiscountPercent: 5, commissionPercent: 14 },
  { maxDiscountPercent: 10, commissionPercent: 12 },
  { maxDiscountPercent: 15, commissionPercent: 10 },
  { maxDiscountPercent: 20, commissionPercent: 8 },
  { maxDiscountPercent: null, commissionPercent: 0 },
];

const DEFAULTS: StoredRates = {
  defaultCommissionPercent: DEFAULT_COMMISSION_RATE * 100,
  marginPercent: 35,
  repCommissionPercent: {},
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
  return raw
    .filter((t): t is { maxDiscountPercent: number | null; commissionPercent: number } =>
      typeof t === "object" && t !== null && "commissionPercent" in t,
    )
    .map((t) => ({
      maxDiscountPercent: t.maxDiscountPercent === null ? null : clampPercent(t.maxDiscountPercent, 0),
      commissionPercent: clampPercent(t.commissionPercent, 0),
    }));
}

export async function readRates(): Promise<StoredRates> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  const value = (row?.value ?? {}) as Partial<StoredRates>;
  const reps: Record<string, number> = {};
  for (const [userId, pct] of Object.entries(value.repCommissionPercent ?? {})) {
    const n = Number(pct);
    if (Number.isFinite(n)) reps[userId] = clampPercent(n, 0);
  }
  return {
    defaultCommissionPercent: clampPercent(value.defaultCommissionPercent, DEFAULTS.defaultCommissionPercent),
    marginPercent: clampPercent(value.marginPercent, DEFAULTS.marginPercent),
    repCommissionPercent: reps,
    appointmentFee: clampPositive(value.appointmentFee, DEFAULTS.appointmentFee),
    commissionTiers: parseTiers(value.commissionTiers),
  };
}

export async function writeRates(rates: StoredRates, updatedById: string): Promise<StoredRates> {
  const clean: StoredRates = {
    defaultCommissionPercent: clampPercent(rates.defaultCommissionPercent, DEFAULTS.defaultCommissionPercent),
    marginPercent: clampPercent(rates.marginPercent, DEFAULTS.marginPercent),
    repCommissionPercent: Object.fromEntries(
      Object.entries(rates.repCommissionPercent).map(([id, pct]) => [id, clampPercent(pct, 0)]),
    ),
    appointmentFee: clampPositive(rates.appointmentFee, DEFAULTS.appointmentFee),
    commissionTiers: parseTiers(rates.commissionTiers),
  };
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: {
      key: KEY,
      category: "sales",
      value: clean as object,
      description: "Commission tiers, appointment fee, per-rep overrides and average gross margin.",
      updatedById,
    },
    update: { value: clean as object, updatedById },
  });
  return clean;
}
