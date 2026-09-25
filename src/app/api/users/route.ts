import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { errorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

export const GET = apiRoute(async () => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const [users, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userInvitation.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { role: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      ghlRole: u.ghlRole,
      roles: u.roles.map((ur) => ({ id: ur.role.id, key: ur.role.key, name: ur.role.name })),
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      email: i.email,
      roleKey: i.role.key,
      roleName: i.role.name,
      expiresAt: i.expiresAt,
    })),
  });
});

/**
 * Invitations are switched off: every team member comes from the GoHighLevel
 * sub-account through first-run setup, so the roster always matches GHL.
 */
export const POST = apiRoute(async () =>
  errorResponse(405, "Team members come from GoHighLevel and can't be invited here.", {
    code: "invite_disabled",
  }),
);
