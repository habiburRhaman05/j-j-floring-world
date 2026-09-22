import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth/session.server";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { errorResponse, zodErrorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

export const GET = apiRoute(async () => {
  const session = await getCurrentSession();
  if (!session) return errorResponse(401, "Sign in to continue.", { code: "unauthenticated" });

  const avatar = session.user.avatarFileId
    ? await prisma.fileAsset.findUnique({ where: { id: session.user.avatarFileId } })
    : null;

  return NextResponse.json({
    id: session.user.id,
    email: session.user.email,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    phone: session.user.phone,
    timezone: session.user.timezone,
    avatarUrl: avatar?.storageKey ?? null,
    roles: session.roles.map((r) => ({ id: r.id, key: r.key, name: r.name })),
  });
});

const UpdateAccountSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    phone: z.string().max(30).nullable().optional(),
    timezone: z.string().min(1).max(100).optional(),
  })
  .strict();

export const PATCH = apiRoute(async (request: NextRequest) => {
  const session = await getCurrentSession();
  if (!session) return errorResponse(401, "Sign in to continue.", { code: "unauthenticated" });

  const json = await request.json().catch(() => null);
  const parsed = UpdateAccountSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const before = {
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    phone: session.user.phone,
    timezone: session.user.timezone,
  };

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
  });

  const { ipAddress, userAgent } = requestMeta(request);
  await writeAudit({
    actorId: session.user.id,
    action: "user.profile.updated",
    entity: "User",
    entityId: session.user.id,
    before,
    after: parsed.data,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    id: updated.id,
    firstName: updated.firstName,
    lastName: updated.lastName,
    phone: updated.phone,
    timezone: updated.timezone,
  });
});
