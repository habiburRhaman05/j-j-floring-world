import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { errorResponse, zodErrorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

async function loadValidInvitation(rawToken: string) {
  const invitation = await prisma.userInvitation.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { role: true },
  });
  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    return null;
  }
  return invitation;
}

/** Validates the token before the accept-invitation page shows a form. */
export const GET = apiRoute(async (request: NextRequest) => {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return errorResponse(400, "This invitation link is missing its token.", { code: "invalid_token" });

  const invitation = await loadValidInvitation(token);
  if (!invitation) {
    return errorResponse(400, "This invitation link is invalid or has expired. Ask your admin to send a new one.", {
      code: "invalid_token",
    });
  }

  return NextResponse.json({
    email: invitation.email,
    roleName: invitation.role.name,
  });
});

const AcceptSchema = z
  .object({
    token: z.string().min(1),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`),
  })
  .strict();

export const POST = apiRoute(async (request: NextRequest) => {
  const json = await request.json().catch(() => null);
  const parsed = AcceptSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const invitation = await loadValidInvitation(parsed.data.token);
  if (!invitation) {
    return errorResponse(400, "This invitation link is invalid or has expired. Ask your admin to send a new one.", {
      code: "invalid_token",
    });
  }

  const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existing) {
    return errorResponse(409, "An account already exists for this email address. Try signing in instead.", {
      code: "already_exists",
    });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const { ipAddress, userAgent } = requestMeta(request);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: invitation.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        passwordHash,
        status: "ACTIVE",
        mustChangePassword: false,
      },
    });
    await tx.userRole.create({ data: { userId: created.id, roleId: invitation.roleId } });
    await tx.userInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    return created;
  });

  await writeAudit({
    actorId: user.id,
    action: "user.invitation.accepted",
    entity: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
    after: { email: user.email, roleId: invitation.roleId },
  });

  return NextResponse.json({ message: "Account created. Sign in to continue." });
});
