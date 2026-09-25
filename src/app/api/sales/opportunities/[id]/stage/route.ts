import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/api-route";
import { zodErrorResponse } from "@/lib/api/server-response";
import { moveSalesOpportunity } from "@/lib/ghl/sales-board";
import { salesFailure, withSalesViewer } from "@/lib/ghl/sales-route";

const MoveSchema = z.object({ stageId: z.string().min(1) }).strict();

/** Drag-and-drop on a sales board: pushed to GHL. A rep may only move their own cards. */
export const PATCH = apiRoute(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const gate = await withSalesViewer();
    if (gate.error) return gate.error;

    const parsed = MoveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const { id } = await params;
    try {
      await moveSalesOpportunity(gate.connection, gate.viewer, id, parsed.data.stageId);
    } catch (error) {
      return salesFailure(error);
    }
    return NextResponse.json({ ok: true });
  },
);
