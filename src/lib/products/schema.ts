import { z } from "zod";
import { PRODUCT_CATEGORIES, TIERS, UNITS } from "@/lib/constants";

/**
 * The body ProductFormDialog sends, shared by the create and update routes so
 * the two can never drift. Cost and price leave the number inputs as strings
 * when the field is empty, so both are coerced here rather than in the form.
 */
export const ProductInputSchema = z.object({
  id: z.string().nullish(),
  name: z.string().trim().min(1, "Give the product a name."),
  sku: z.string().trim().max(64).nullish(),
  description: z.string().trim().max(2000).nullish(),
  category: z.enum(PRODUCT_CATEGORIES),
  unit: z.enum(UNITS),
  tier: z.enum(TIERS).nullish(),
  costPerUnit: z.coerce.number().min(0, "Cost cannot be negative."),
  pricePerUnit: z.coerce.number().min(0, "Price cannot be negative."),
  commissionRate: z.union([z.number(), z.string()]).nullish(),
  /** e.g. 0.1 = 10% waste factor. */
  wasteFactor: z.coerce.number().min(0).max(1).nullish(),
  taxable: z.boolean().optional(),
  active: z.boolean().optional(),
});
