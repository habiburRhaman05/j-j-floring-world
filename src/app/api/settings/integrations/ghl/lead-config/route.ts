import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { saveGhlLeadConfig } from "@/lib/ghl/client";
import { zodErrorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

const Schema = z.object({
  leadPipelineId: z.string().min(1),
  leadTag: z.string().min(1),
});

/** Updates just the pipeline/tag the CSR board watches, no token re-entry needed. */
export const PATCH = apiRoute(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const json = await request.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  await saveGhlLeadConfig(parsed.data.leadPipelineId, parsed.data.leadTag);
  return NextResponse.json({ message: "Lead pipeline settings saved." });
});
