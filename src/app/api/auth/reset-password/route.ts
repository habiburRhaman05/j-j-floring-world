import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { errorResponse, zodErrorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

const ResetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`),
  })
  .strict();

export const POST = apiRoute(async (request: NextRequest) => {
  const json = await request.json().catch(() => null);
  const parsed = ResetPasswordSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return errorResponse(400, "This reset link is invalid or has expired. Request a new one.", {
      code: "invalid_token",
    });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const { ipAddress, userAgent } = requestMeta(request);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  await writeAudit({
    actorId: record.userId,
    action: "auth.password_reset.completed",
    entity: "User",
    entityId: record.userId,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ message: "Password updated. Sign in with your new password." });
});
