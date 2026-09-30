import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/api-route";
import { zodErrorResponse } from "@/lib/api/server-response";
import { requestMeta, writeAudit } from "@/lib/auth/audit";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

const money = z.coerce.number().min(0, "Can't be negative.").max(1_000_000);

const CostSchema = z
  .object({
    ghlProductId: z.string().min(1),
    ghlPriceId: z.string().min(1),
    installCost: money,
    materialCost: money,
  })
  .strict();

/** Admin: every recorded install + material cost, keyed by "<productId>:<priceId>". */
export const GET = apiRoute(async () => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const rows = await prisma.productCost.findMany();
  return NextResponse.json({
    costs: rows.map((r) => ({
      id: `${r.ghlProductId}:${r.ghlPriceId}`,
      installCost: Number(r.installCost),
      materialCost: Number(r.materialCost),
    })),
  });
});

/** Admin: set the install + material cost of one GHL product price. */
export const PUT = apiRoute(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const parsed = CostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { ghlProductId, ghlPriceId, installCost, materialCost } = parsed.data;

  const key = { ghlProductId_ghlPriceId: { ghlProductId, ghlPriceId } };
  const before = await prisma.productCost.findUnique({ where: key });
  const saved = await prisma.productCost.upsert({
    where: key,
    create: { ghlProductId, ghlPriceId, installCost, materialCost, updatedById: gate.session.user.id },
    update: { installCost, materialCost, updatedById: gate.session.user.id },
  });
  await writeAudit({
    actorId: gate.session.user.id,
    action: "product.cost.updated",
    entity: "ProductCost",
    entityId: saved.id,
    before: before ? { installCost: Number(before.installCost), materialCost: Number(before.materialCost) } : null,
    after: { installCost, materialCost },
    ...requestMeta(request),
  });
  return NextResponse.json({
    id: `${ghlProductId}:${ghlPriceId}`,
    installCost: Number(saved.installCost),
    materialCost: Number(saved.materialCost),
  });
});
