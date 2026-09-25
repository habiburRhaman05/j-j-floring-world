import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COMMISSION_RATE } from "@/lib/constants";

/* Commission and margin rates, kept in app_settings under one key. */

const KEY = "sales.rates";

export interface StoredRates {
  defaultCommissionPercent: number;
  marginPercent: number;
  repCommissionPercent: Record<string, number>;
}

const DEFAULTS: StoredRates = {
  defaultCommissionPercent: DEFAULT_COMMISSION_RATE * 100,
  marginPercent: 35,
  repCommissionPercent: {},
};

function clampPercent(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 100) : fallback;
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
  };
}

export async function writeRates(rates: StoredRates, updatedById: string): Promise<StoredRates> {
  const clean: StoredRates = {
    defaultCommissionPercent: clampPercent(rates.defaultCommissionPercent, DEFAULTS.defaultCommissionPercent),
    marginPercent: clampPercent(rates.marginPercent, DEFAULTS.marginPercent),
    repCommissionPercent: Object.fromEntries(
      Object.entries(rates.repCommissionPercent).map(([id, pct]) => [id, clampPercent(pct, 0)]),
    ),
  };
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: {
      key: KEY,
      category: "sales",
      value: clean as object,
      description: "Commission percent per rep, default commission percent and average gross margin.",
      updatedById,
    },
    update: { value: clean as object, updatedById },
  });
  return clean;
}
