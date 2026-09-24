import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api/api-route";
import { requireApiUser } from "@/lib/auth/require-api-user";
import { requireAdmin } from "@/lib/auth/require-admin";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { zodErrorResponse } from "@/lib/api/server-response";
import { categoryKey, tierToDb, toProduct, unitToDb } from "@/lib/products/map";
import { ProductInputSchema } from "@/lib/products/schema";

/**
 * The product catalog. Cost is carried on the payload; hiding it from a Sales
 * Rep is the render-layer rule `can.viewCost` enforces in the UI, the same way
 * the workspace snapshot already behaves.
 */
export const GET = apiRoute(async () => {
  const gate = await requireApiUser();
  if (gate.error) return gate.error;

  const rows = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { category: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(rows.map(toProduct));
});

export const POST = apiRoute(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { session } = gate;

  const json = await request.json().catch(() => null);
  const parsed = ProductInputSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { name, category, unit, costPerUnit, pricePerUnit, tier } = parsed.data;
  const key = categoryKey(category);

  const row = await prisma.$transaction(async (tx) => {
    const categoryRow = await tx.productCategory.upsert({
      where: { key },
      update: {},
      create: { key, name: category },
    });

    return tx.product.create({
      data: {
        name,
        categoryId: categoryRow.id,
        unit: unitToDb(unit),
        costPerUnit,
        pricePerUnit,
        tierAffinity: tierToDb(tier),
      },
      include: { category: true },
    });
  });

  const { ipAddress, userAgent } = requestMeta(request);
  await writeAudit({
    actorId: session.user.id,
    action: "product.created",
    entity: "Product",
    entityId: row.id,
    after: {
      name: row.name,
      category,
      unit: row.unit,
      costPerUnit,
      pricePerUnit,
      tier: row.tierAffinity,
    },
    ipAddress,
    userAgent,
  });

  return NextResponse.json(toProduct(row), { status: 201 });
});
