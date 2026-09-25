import { NextResponse, type NextRequest } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { zodErrorResponse } from "@/lib/api/server-response";
import { getEstimateForViewer, saveEstimate } from "@/lib/estimates/estimates.server";
import { EstimateSaveSchema, estimateFailure } from "@/lib/estimates/route-helpers";
import { withSalesViewer } from "@/lib/ghl/sales-route";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiRoute(async (_request: NextRequest, { params }: Ctx) => {
  const gate = await withSalesViewer();
  if (gate.error) return gate.error;
  try {
    return NextResponse.json(await getEstimateForViewer(gate.viewer, (await params).id));
  } catch (error) {
    return estimateFailure(error);
  }
});

export const PUT = apiRoute(async (request: NextRequest, { params }: Ctx) => {
  const gate = await withSalesViewer();
  if (gate.error) return gate.error;

  const parsed = EstimateSaveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    return NextResponse.json(await saveEstimate(gate.connection, gate.viewer, (await params).id, parsed.data));
  } catch (error) {
    return estimateFailure(error);
  }
});
