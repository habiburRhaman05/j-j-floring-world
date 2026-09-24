import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getGhlConnection, listPipelines } from "@/lib/ghl/client";
import { errorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

/** Lets the admin pick a pipeline from a dropdown instead of pasting an ID. */
export const GET = apiRoute(async () => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const connection = await getGhlConnection();
  if (!connection) {
    return errorResponse(409, "Connect GoHighLevel (Location ID + token) above first.", {
      code: "ghl_not_configured",
    });
  }

  try {
    const pipelines = await listPipelines(connection);
    return NextResponse.json({
      pipelines: pipelines.map((p) => ({
        id: p.id,
        name: p.name,
        stages: p.stages.map((s) => ({ id: s.id, name: s.name })),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error reaching GoHighLevel.";
    return errorResponse(502, message, { code: "ghl_request_failed" });
  }
});
