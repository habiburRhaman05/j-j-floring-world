import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isSoleActiveAdmin } from "@/lib/auth/require-admin";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { errorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

/** Suspension terminates all active sessions immediately (FR-ADM-21). */
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

    if (await isSoleActiveAdmin(id)) {
      return errorResponse(422, "This is the only active admin and cannot be suspended.", {
        code: "last_admin",
      });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { status: "SUSPENDED" } }),
      prisma.session.deleteMany({ where: { userId: id } }),
      prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    const { ipAddress, userAgent } = requestMeta(request);
    await writeAudit({
      actorId: session.user.id,
      action: "user.suspended",
      entity: "User",
      entityId: id,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ message: "User suspended." });
  },
);
