import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { sendMail, appUrl } from "@/lib/mail/send-mail";
import { errorResponse, zodErrorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

const InviteSchema = z
  .object({
    email: z.string().email(),
    roleKey: z.string().min(1),
  })
  .strict();

export const POST = apiRoute(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { session } = gate;

  const json = await request.json().catch(() => null);
  const parsed = InviteSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const email = parsed.data.email.toLowerCase().trim();
  const { ipAddress, userAgent } = requestMeta(request);

  const role = await prisma.role.findUnique({ where: { key: parsed.data.roleKey } });
  if (!role) {
    return errorResponse(422, "That role does not exist.", {
      code: "validation_error",
      fields: [{ field: "roleKey", message: "Unknown role." }],
    });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return errorResponse(409, "An account already exists for this email address.", {
      code: "already_exists",
      fields: [{ field: "email", message: "Already registered." }],
    });
  }

  const token = generateToken();
  const invitation = await prisma.$transaction(async (tx) => {
    // Superseding an unaccepted invite lets an admin re-send without a
    // duplicate-key error piling up expired rows for the same email.
    await tx.userInvitation.deleteMany({ where: { email, acceptedAt: null } });
    return tx.userInvitation.create({
      data: {
        email,
        roleId: role.id,
        invitedById: session.user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });
  });

  await writeAudit({
    actorId: session.user.id,
    action: "user.invited",
    entity: "UserInvitation",
    entityId: invitation.id,
    ipAddress,
    userAgent,
    after: { email, roleId: role.id },
  });

  const inviteLink = appUrl(`/accept-invitation?token=${token}`);

  await sendMail({
    to: email,
    subject: "You're invited to J&J Flooring World",
    text: `You've been invited as ${role.name}. Accept your invitation: ${inviteLink}\n\nThis link expires in 7 days.`,
  });

  // Email sending is stubbed for now (logs to the server console rather than
  // actually delivering), so the link is also handed back here for the admin
  // UI to display/copy directly - otherwise there is no way to reach the
  // invited person until a real email provider is wired in.
  return NextResponse.json({ message: "Invitation sent.", inviteLink }, { status: 201 });
});
