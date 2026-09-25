import "server-only";
import type { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/server-response";
import { salesFailure } from "@/lib/ghl/sales-route";
import { PRODUCT_CATEGORIES, UNITS } from "@/lib/constants";
import { EstimateError } from "./estimates.server";

export function estimateFailure(error: unknown): NextResponse {
  if (error instanceof EstimateError) return errorResponse(error.status, error.message, { code: error.code });
  return salesFailure(error);
}

const money = z.coerce.number().finite();

const LineSchema = z.object({
  id: z.string(),
  productId: z.string().nullable(),
  name: z.string().max(300),
  description: z.string().max(2000).nullable(),
  category: z.enum(PRODUCT_CATEGORIES).nullable().catch(null),
  unit: z.enum(UNITS),
  qty: money.min(0),
  unitPrice: money,
  unitCost: money.min(0),
  taxable: z.boolean(),
  isCustom: z.boolean(),
  ghlProductId: z.string().max(64).nullish(),
  ghlPriceId: z.string().max(64).nullish(),
});

const MetaSchema = z.object({
  label: z.string().max(80).nullable(),
  summary: z.string().max(2000).nullable(),
  discountType: z.enum(["percent", "amount"]).nullable(),
  discountValue: money.min(0),
  discountReason: z.string().max(500).nullable(),
});

const tiers = <T extends z.ZodTypeAny>(item: T) => z.object({ Good: item, Better: item, Best: item });

/** What the estimate builder posts. `repId` is ignored: the server decides who the estimate is for. */
export const EstimateSaveSchema = z.object({
  id: z.string().nullish(),
  leadId: z.string().min(1, "Pick a customer first."),
  repId: z.string().optional(),
  depositPercent: money.min(0).max(100),
  taxRate: money.min(0).max(30).default(0),
  tiers: tiers(z.array(LineSchema).max(200)),
  tierMeta: tiers(MetaSchema).optional(),
  customerNotes: z.string().max(5000).nullish(),
  internalNotes: z.string().max(5000).nullish(),
});
