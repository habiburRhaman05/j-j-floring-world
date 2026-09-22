import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { decryptSecret, maskSecret } from "@/lib/crypto/secret-box";
import { saveGhlConnection } from "@/lib/ghl/client";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { zodErrorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

export const GET = apiRoute(async () => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const credential = await prisma.integrationCredential.findUnique({
    where: { provider: "gohighlevel" },
  });

  if (!credential) {
    return NextResponse.json({ connected: false });
  }

  let maskedToken: string | null = null;
  try {
    maskedToken = maskSecret(decryptSecret(credential.encryptedToken));
  } catch {
    maskedToken = "••••••••";
  }

  return NextResponse.json({
    connected: true,
    locationId: credential.locationId,
    maskedToken,
    connectedAt: credential.connectedAt,
    lastVerifiedAt: credential.lastVerifiedAt,
    lastVerifyError: credential.lastVerifyError,
  });
});

const SaveSchema = z
  .object({
    locationId: z.string().min(1),
    token: z.string().min(10),
  })
  .strict();

export const PATCH = apiRoute(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { session } = gate;

  const json = await request.json().catch(() => null);
  const parsed = SaveSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  await saveGhlConnection(parsed.data.locationId, parsed.data.token, session.user.id);

  const { ipAddress, userAgent } = requestMeta(request);
  // Never write the token itself, masked or otherwise, into the audit log.
  await writeAudit({
    actorId: session.user.id,
    action: "settings.ghl.connected",
    entity: "IntegrationCredential",
    entityId: "gohighlevel",
    after: { locationId: parsed.data.locationId },
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ message: "GoHighLevel connection saved." });
});
