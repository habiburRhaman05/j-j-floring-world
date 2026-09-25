import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/api-route";
import { zodErrorResponse } from "@/lib/api/server-response";
import { moveOpportunity } from "@/lib/ghl/csr-board";
import { ghlFailure, withCsrConnection } from "@/lib/ghl/csr-route";

const MoveSchema = z.object({
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
});

/** Drag-and-drop on the CSR board: the stage change is written to GHL. */
export const PATCH = apiRoute(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const gate = await withCsrConnection();
    if (gate.error) return gate.error;

    const parsed = MoveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const { id } = await params;
    try {
      await moveOpportunity(gate.connection, id, parsed.data.pipelineId, parsed.data.stageId);
    } catch (error) {
      return ghlFailure(error);
    }
    return NextResponse.json({ ok: true });
  },
);
