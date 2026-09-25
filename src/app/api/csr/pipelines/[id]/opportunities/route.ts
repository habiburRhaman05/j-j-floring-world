import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { fetchBoardOpportunities } from "@/lib/ghl/csr-board";
import { ghlFailure, withCsrConnection } from "@/lib/ghl/csr-route";

/** Every open opportunity sitting in one pipeline, read live from GHL. */
export const GET = apiRoute(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const gate = await withCsrConnection();
    if (gate.error) return gate.error;

    const { id } = await params;
    try {
      const opportunities = await fetchBoardOpportunities(gate.connection, id);
      return NextResponse.json({ pipelineId: id, opportunities });
    } catch (error) {
      return ghlFailure(error);
    }
  },
);
