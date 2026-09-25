import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api/api-route";
import { requireAdmin } from "@/lib/auth/require-admin";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { errorResponse, zodErrorResponse } from "@/lib/api/server-response";
import { categoryKey, tierToDb, toProduct, unitToDb } from "@/lib/products/map";
import { ProductInputSchema } from "@/lib/products/schema";

/**
 * Edit a product. A change to cost or price also appends a ProductPriceHistory
 * row (FR-ADM-14) - that table is append-only, so it is written in the same
 * transaction as the update and never touched again.
 */
export const PUT = apiRoute(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const gate = await requireAdmin();
    if (gate.error) return gate.error;
    const { session } = gate;

    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = ProductInputSchema.safeParse(json);
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const existing = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!existing || existing.deletedAt) {
      return errorResponse(404, "That product no longer exists.", { code: "not_found" });
    }

    const { name, sku, description, category, unit, costPerUnit, pricePerUnit, tier, active, wasteFactor, taxable } =
      parsed.data;
    const key = categoryKey(category);
    const priceChanged =
      Number(existing.costPerUnit) !== costPerUnit ||
      Number(existing.pricePerUnit) !== pricePerUnit;

    const row = await prisma.$transaction(async (tx) => {
      const categoryRow = await tx.productCategory.upsert({
        where: { key },
        update: {},
        create: { key, name: category },
      });

      const updated = await tx.product.update({
        where: { id },
        data: {
          name,
          sku: sku || null,
          description: description || null,
          categoryId: categoryRow.id,
          unit: unitToDb(unit),
          costPerUnit,
          pricePerUnit,
          tierAffinity: tierToDb(tier),
          wasteFactor: wasteFactor ?? null,
          ...(typeof taxable === "boolean" ? { taxable } : {}),
          ...(typeof active === "boolean" ? { active } : {}),
        },
        include: { category: true },
      });

      if (priceChanged) {
        await tx.productPriceHistory.create({
          data: {
            productId: id,
            actorId: session.user.id,
            oldCost: existing.costPerUnit,
            newCost: updated.costPerUnit,
            oldPrice: existing.pricePerUnit,
            newPrice: updated.pricePerUnit,
          },
        });
      }

      return updated;
    });

    const { ipAddress, userAgent } = requestMeta(request);
    await writeAudit({
      actorId: session.user.id,
      action: "product.updated",
      entity: "Product",
      entityId: id,
      before: {
        name: existing.name,
        category: existing.category.name,
        unit: existing.unit,
        costPerUnit: Number(existing.costPerUnit),
        pricePerUnit: Number(existing.pricePerUnit),
        tier: existing.tierAffinity,
        active: existing.active,
      },
      after: {
        name: row.name,
        category: row.category.name,
        unit: row.unit,
        costPerUnit: Number(row.costPerUnit),
        pricePerUnit: Number(row.pricePerUnit),
        tier: row.tierAffinity,
        active: row.active,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(toProduct(row));
  },
);
