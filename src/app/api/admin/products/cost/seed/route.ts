import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import { getGhlConnection } from "@/lib/ghl/client";
import { fetchPriceBook } from "@/lib/ghl/price-book";

/**
 * Product cost data from the JJ_Flooring_Job_Calculator spreadsheet (Pricing sheet).
 * Keyed by the GHL price-label (the variant name the admin sees).
 */
const SPREADSHEET_COSTS: Record<string, { installCost: number; materialCost: number }> = {
  "Jaguar - Carpet":    { installCost: 2.02, materialCost: 1.11 },
  "Harvest - Carpet":   { installCost: 2.02, materialCost: 1.44 },
  "Resolve - Carpet":   { installCost: 2.02, materialCost: 1.78 },
  "Faculty - Carpet":   { installCost: 2.02, materialCost: 2.00 },
  "Alpine - Vinyl":     { installCost: 2.96, materialCost: 1.59 },
  "Montclair - Vinyl":  { installCost: 2.96, materialCost: 1.69 },
  "Citadel - Vinyl":    { installCost: 2.96, materialCost: 2.09 },
};

/** Normalise a name for fuzzy matching. */
const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Admin-only: one-time seed of product costs from the costing spreadsheet. */
export const POST = apiRoute(async () => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const connection = await getGhlConnection();
  if (!connection) {
    return NextResponse.json(
      { error: "GHL is not connected. Connect it in Admin -> Sync & Settings first." },
      { status: 422 },
    );
  }

  const items = await fetchPriceBook(connection);
  const results: { name: string; matched: boolean; ghlProductId?: string; ghlPriceId?: string }[] = [];

  for (const item of items) {
    // Match by priceLabel first (the variant name), then by the full name
    const label = item.priceLabel || item.name;
    const costs =
      SPREADSHEET_COSTS[label] ??
      Object.entries(SPREADSHEET_COSTS).find(
        ([key]) => norm(key) === norm(label),
      )?.[1];

    if (!costs) {
      results.push({ name: label, matched: false });
      continue;
    }

    await prisma.productCost.upsert({
      where: {
        ghlProductId_ghlPriceId: {
          ghlProductId: item.productId,
          ghlPriceId: item.priceId,
        },
      },
      create: {
        ghlProductId: item.productId,
        ghlPriceId: item.priceId,
        installCost: costs.installCost,
        materialCost: costs.materialCost,
        updatedById: gate.session.user.id,
      },
      update: {
        installCost: costs.installCost,
        materialCost: costs.materialCost,
        updatedById: gate.session.user.id,
      },
    });

    results.push({
      name: label,
      matched: true,
      ghlProductId: item.productId,
      ghlPriceId: item.priceId,
    });
  }

  return NextResponse.json({
    seeded: results.filter((r) => r.matched).length,
    unmatched: results.filter((r) => !r.matched).map((r) => r.name),
    results,
  });
});
