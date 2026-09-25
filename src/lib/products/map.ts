/* ==========================================================================
   map.ts  -  the seam between the Prisma product row and the UI's Product
   --------------------------------------------------------------------------
   The UI's Product type predates the database, so two spellings differ and are
   translated here, once, instead of in every route or component:

     unit  the UI says "YD" (square yard), the Postgres enum says "SY"
     tier  the UI says "Good", the enum says "GOOD"

   `commissionRate` has no column yet - doc 07 keeps per-product commission in
   the commission rules table, which is not built - so it always reads back as
   null, meaning "pay the rep's standard rate".
   ========================================================================== */

import type {
  Product as ProductRow,
  ProductCategory as ProductCategoryRow,
  TierLevel,
  UnitOfMeasure,
} from "@prisma/client";
import type { Product, ProductCategory, Tier, Unit } from "@/lib/types";

/** A product row with its category joined, as every reader selects it. */
export type ProductWithCategory = ProductRow & { category: ProductCategoryRow };

/** Every enum unit has a UI spelling; only square yard is spelled differently. */
const UNIT_FROM_DB: Record<UnitOfMeasure, Unit> = {
  SF: "SF",
  SY: "YD",
  LF: "LF",
  EA: "EA",
  HR: "HR",
  GAL: "GAL",
  BOX: "BOX",
};

const UNIT_TO_DB: Record<Unit, UnitOfMeasure> = {
  SF: "SF",
  YD: "SY",
  LF: "LF",
  EA: "EA",
  HR: "HR",
  GAL: "GAL",
  BOX: "BOX",
};

const TIER_FROM_DB: Record<TierLevel, Tier> = {
  GOOD: "Good",
  BETTER: "Better",
  BEST: "Best",
};

const TIER_TO_DB: Record<Tier, TierLevel> = {
  Good: "GOOD",
  Better: "BETTER",
  Best: "BEST",
};

export function unitToDb(unit: Unit): UnitOfMeasure {
  return UNIT_TO_DB[unit];
}

export function tierToDb(tier: Tier | null | undefined): TierLevel | null {
  return tier ? TIER_TO_DB[tier] : null;
}

/**
 * The stable key a category name is filed under. Categories are a table rather
 * than an enum (FR-ADM-17), so a name the seed has never seen is created on
 * first use instead of failing the save.
 */
export function categoryKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toProduct(row: ProductWithCategory): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku ?? null,
    description: row.description ?? null,
    category: row.category.name as ProductCategory,
    unit: UNIT_FROM_DB[row.unit],
    costPerUnit: Number(row.costPerUnit),
    pricePerUnit: Number(row.pricePerUnit),
    tier: row.tierAffinity ? TIER_FROM_DB[row.tierAffinity] : null,
    commissionRate: null,
    wasteFactor: row.wasteFactor === null || row.wasteFactor === undefined ? null : Number(row.wasteFactor),
    taxable: row.taxable,
    active: row.active,
  };
}
