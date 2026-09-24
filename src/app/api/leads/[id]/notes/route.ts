import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/api-route";
import { requireApiUser } from "@/lib/auth/require-api-user";
import { zodErrorResponse } from "@/lib/api/server-response";
import { resolveConnection, pushNote, fetchLiveLeads, GhlNotConfiguredError } from "@/lib/ghl/leads-sync";
import { errorResponse } from "@/lib/api/server-response";

const NoteSchema = z.object({ text: z.string().min(1), by: z.string().optional() });

/** Logged as a note on the GHL contact - outreach history lives in GHL, not a local copy. */
export const POST = apiRoute(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await requireApiUser(["admin", "csr"]);
  if (gate.error) return gate.error;

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = NoteSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  let connection;
  try {
    connection = await resolveConnection();
  } catch (error) {
    if (error instanceof GhlNotConfiguredError) return errorResponse(409, error.message, { code: "ghl_not_configured" });
    throw error;
  }

  try {
    await pushNote(connection, decodeURIComponent(id), parsed.data.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error reaching GoHighLevel.";
    return errorResponse(502, message, { code: "ghl_request_failed" });
  }

  const { leads } = await fetchLiveLeads(connection);
  const updated = leads.find((l) => l.id === decodeURIComponent(id)) ?? null;
  return NextResponse.json(updated);
});
