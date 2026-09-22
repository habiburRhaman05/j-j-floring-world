import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { verifyConnection } from "@/lib/ghl/client";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { errorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

export const POST = apiRoute(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { session } = gate;

  const result = await verifyConnection();

  const { ipAddress, userAgent } = requestMeta(request);
  await writeAudit({
    actorId: session.user.id,
    action: "settings.ghl.tested",
    entity: "IntegrationCredential",
    entityId: "gohighlevel",
    after: result,
    ipAddress,
    userAgent,
  });

  if (!result.ok) {
    return errorResponse(422, result.error ?? "Could not verify the GoHighLevel connection.", {
      code: "ghl_verify_failed",
    });
  }

  return NextResponse.json({ message: "Connection verified." });
});
