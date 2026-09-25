import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, isSoleActiveAdmin } from "@/lib/auth/require-admin";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { errorResponse, zodErrorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";
import { appRoleForKey } from "@/lib/auth/app-role";

const UpdateUserSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    roleKey: z.string().min(1).optional(),
  })
  .strict();

export const PATCH = apiRoute(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const gate = await requireAdmin();
    if (gate.error) return gate.error;
    const { session } = gate;
    const { id } = await params;

    const json = await request.json().catch(() => null);
    const parsed = UpdateUserSchema.safeParse(json);
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const target = await prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!target || target.deletedAt) {
      return errorResponse(404, "That user no longer exists.", { code: "not_found" });
    }

    let role = null;
    if (parsed.data.roleKey) {
      role = await prisma.role.findUnique({ where: { key: parsed.data.roleKey } });
      if (!role) {
        return errorResponse(422, "That role does not exist.", {
          code: "validation_error",
          fields: [{ field: "roleKey", message: "Unknown role." }],
        });
      }
      const currentlyAdmin = target.roles.some((ur) => ur.role.key === "admin");
      if (currentlyAdmin && role.key !== "admin" && (await isSoleActiveAdmin(id))) {
        return errorResponse(
          422,
          "This is the only active admin - assign another admin before changing this role.",
          { code: "last_admin" },
        );
      }
    }

    const before = {
      firstName: target.firstName,
      lastName: target.lastName,
      roles: target.roles.map((ur) => ur.role.key),
    };

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
        },
      });
      if (role) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.create({ data: { userId: id, roleId: role.id } });
        await tx.user.update({ where: { id }, data: { role: appRoleForKey(role.key) } });
      }
      return user;
    });

    const { ipAddress, userAgent } = requestMeta(request);
    await writeAudit({
      actorId: session.user.id,
      action: "user.updated",
      entity: "User",
      entityId: id,
      before,
      after: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        roleKey: role?.key ?? before.roles[0],
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ message: "User updated." });
  },
);

/**
 * Team members are never removed from the app: the roster mirrors the GHL
 * sub-account, and removing someone would orphan their leads, estimates and
 * commission history. Suspend them instead (POST /api/users/:id/suspend).
 */
export const DELETE = apiRoute(async () =>
  errorResponse(405, "Team members can't be removed. Suspend them instead.", {
    code: "remove_disabled",
  }),
);
