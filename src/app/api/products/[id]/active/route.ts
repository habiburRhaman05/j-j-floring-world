import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api/api-route";
import { requireAdmin } from "@/lib/auth/require-admin";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { errorResponse } from "@/lib/api/server-response";
import { toProduct } from "@/lib/products/map";

/**
 * Activate or deactivate a product (FR-ADM-11). Products are never deleted:
 * deactivating takes one out of new estimates and leaves every estimate, job
 * and invoice line that already names it intact.
 */
export const PATCH = apiRoute(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const gate = await requireAdmin();
    if (gate.error) return gate.error;
    const { session } = gate;

    const { id } = await params;

    const existing = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!existing || existing.deletedAt) {
      return errorResponse(404, "That product no longer exists.", { code: "not_found" });
    }

    const row = await prisma.product.update({
      where: { id },
      data: { active: !existing.active },
      include: { category: true },
    });

    const { ipAddress, userAgent } = requestMeta(request);
    await writeAudit({
      actorId: session.user.id,
      action: row.active ? "product.reactivated" : "product.deactivated",
      entity: "Product",
      entityId: id,
      before: { active: existing.active },
      after: { active: row.active },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(toProduct(row));
  },
);
