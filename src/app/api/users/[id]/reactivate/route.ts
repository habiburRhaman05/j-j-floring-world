import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { errorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

export const POST = apiRoute(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const gate = await requireAdmin();
    if (gate.error) return gate.error;
    const { session } = gate;
    const { id } = await params;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) {
      return errorResponse(404, "That user no longer exists.", { code: "not_found" });
    }

    await prisma.user.update({ where: { id }, data: { status: "ACTIVE" } });

    const { ipAddress, userAgent } = requestMeta(request);
    await writeAudit({
      actorId: session.user.id,
      action: "user.reactivated",
      entity: "User",
      entityId: id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ message: "User reactivated." });
  },
);
