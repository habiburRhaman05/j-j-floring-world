import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session.server";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { errorResponse, zodErrorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`),
  })
  .strict();

export const POST = apiRoute(async (request: NextRequest) => {
  const session = await getCurrentSession();
  if (!session) return errorResponse(401, "Sign in to continue.", { code: "unauthenticated" });

  const json = await request.json().catch(() => null);
  const parsed = ChangePasswordSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  if (!session.user.passwordHash) {
    return errorResponse(422, "This account has no password set yet.", { code: "no_password" });
  }

  const valid = await verifyPassword(session.user.passwordHash, parsed.data.currentPassword);
  if (!valid) {
    return errorResponse(401, "Your current password is incorrect.", {
      code: "invalid_credentials",
      fields: [{ field: "currentPassword", message: "Incorrect password." }],
    });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash, mustChangePassword: false },
    }),
    // Keep the current session alive; drop every other one.
    prisma.session.deleteMany({
      where: { userId: session.user.id, id: { not: session.sessionId } },
    }),
  ]);

  const { ipAddress, userAgent } = requestMeta(request);
  await writeAudit({
    actorId: session.user.id,
    action: "user.password.changed",
    entity: "User",
    entityId: session.user.id,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ message: "Password updated." });
});
