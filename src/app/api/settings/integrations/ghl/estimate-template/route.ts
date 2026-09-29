import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { errorResponse } from "@/lib/api/server-response";
import { requireApiUser } from "@/lib/auth/require-api-user";
import { getGhlConnection } from "@/lib/ghl/client";
import {
  EstimateDocumentError,
  ensureEstimateFields,
  ESTIMATE_FIELDS,
  ESTIMATE_TEMPLATE_NAME,
} from "@/lib/estimates/ghl-document.server";

/**
 * GET /api/settings/integrations/ghl/estimate-template
 *
 * Ensures every "Estimate - ..." contact field exists on the GHL location
 * (creates the missing ones; NEVER touches existing fields), then returns
 * every field's merge tag so the admin can paste them into the GHL
 * Documents & Contracts template. The template itself is built once by
 * hand in GHL - this route is the setup helper for that step.
 */
export const GET = apiRoute(async () => {
  const gate = await requireApiUser(["admin"]);
  if (gate.error) return gate.error;

  const connection = await getGhlConnection();
  if (!connection) {
    return errorResponse(409, "Connect your account first (Admin > Sync & Settings).", {
      code: "ghl_not_configured",
    });
  }

  try {
    const fields = await ensureEstimateFields(connection);
    return NextResponse.json({
      templateName: ESTIMATE_TEMPLATE_NAME,
      fields: ESTIMATE_FIELDS.map((spec) => ({
        key: spec.key,
        name: spec.name,
        type: spec.type,
        mergeTag: fields.get(spec.key)!.mergeTag,
      })),
    });
  } catch (error) {
    if (error instanceof EstimateDocumentError) {
      return errorResponse(error.status, error.message, { code: error.code });
    }
    throw error;
  }
});
