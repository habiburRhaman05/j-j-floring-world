import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session.server";
import { serializeSessionUser } from "@/lib/auth/serialize";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { isLoginLocked } from "@/lib/auth/rate-limit";
import { errorResponse, zodErrorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

const LoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

const ABSOLUTE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // seconds

export const POST = apiRoute(async (request: NextRequest) => {
  const json = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const email = parsed.data.email.toLowerCase().trim();
  const { ipAddress, userAgent } = requestMeta(request);

  if (await isLoginLocked(email, ipAddress)) {
    return errorResponse(429, "Too many failed attempts. Try again in a few minutes.", {
      code: "rate_limited",
    });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });

  const genericFailure = async () => {
    await writeAudit({
      action: "auth.login.failed",
      entity: "User",
      entityId: email,
      ipAddress,
      userAgent,
    });
    return errorResponse(401, "Incorrect email or password.", { code: "invalid_credentials" });
  };

  if (!user || !user.passwordHash || user.deletedAt) return genericFailure();

  const validPassword = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!validPassword) return genericFailure();

  if (user.status !== "ACTIVE") {
    await writeAudit({
      actorId: user.id,
      action: "auth.login.blocked",
      entity: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
      after: { status: user.status },
    });
    return errorResponse(403, "Your account is not active. Contact an administrator.", {
      code: "account_inactive",
    });
  }

  const { token, expires } = await createSession(user.id, { ipAddress, userAgent });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_COOKIE_MAX_AGE,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({
    actorId: user.id,
    action: "auth.login.succeeded",
    entity: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  const roles = user.roles.map((ur) => ur.role);
  return NextResponse.json({
    user: serializeSessionUser(user, roles),
    expiresAt: expires.toISOString(),
  });
});
