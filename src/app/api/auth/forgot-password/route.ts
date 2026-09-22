import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { sendMail, appUrl } from "@/lib/mail/send-mail";
import { zodErrorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const ForgotPasswordSchema = z.object({ email: z.string().email() }).strict();

/**
 * Always responds 200 with the same message, whether or not the email is
 * registered - a 404 here would let anyone enumerate staff email addresses.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const json = await request.json().catch(() => null);
  const parsed = ForgotPasswordSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const email = parsed.data.email.toLowerCase().trim();
  const { ipAddress, userAgent } = requestMeta(request);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status === "ACTIVE" && !user.deletedAt) {
    const token = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    await writeAudit({
      actorId: user.id,
      action: "auth.password_reset.requested",
      entity: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
    });
    await sendMail({
      to: user.email,
      subject: "Reset your J&J Flooring World password",
      text: `Reset your password: ${appUrl(`/reset-password?token=${token}`)}\n\nThis link expires in 30 minutes. If you did not request this, ignore this email.`,
    });
  }

  return NextResponse.json({
    message: "If that address is registered, a reset link has been sent.",
  });
});
