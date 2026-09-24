import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/api-route";
import { requireApiUser } from "@/lib/auth/require-api-user";
import { zodErrorResponse } from "@/lib/api/server-response";
import { resolveConnection, pushStageChange, fetchLiveLeads, GhlNotConfiguredError } from "@/lib/ghl/leads-sync";
import { errorResponse } from "@/lib/api/server-response";
import { SALES_STAGES } from "@/lib/constants";

const StageSchema = z.object({ stage: z.enum(SALES_STAGES) });

/** Drag-and-drop on the intake board, and the dialog's stage select, both call this. */
export const PATCH = apiRoute(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await requireApiUser(["admin", "csr"]);
  if (gate.error) return gate.error;

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = StageSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  let connection;
  try {
    connection = await resolveConnection();
  } catch (error) {
    if (error instanceof GhlNotConfiguredError) return errorResponse(409, error.message, { code: "ghl_not_configured" });
    throw error;
  }

  try {
    await pushStageChange(connection, decodeURIComponent(id), parsed.data.stage);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error reaching GoHighLevel.";
    return errorResponse(502, message, { code: "ghl_request_failed" });
  }

  const { leads } = await fetchLiveLeads(connection);
  const updated = leads.find((l) => l.id === decodeURIComponent(id)) ?? null;
  return NextResponse.json(updated);
});
