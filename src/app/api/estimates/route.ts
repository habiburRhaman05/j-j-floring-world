import { NextResponse, type NextRequest } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { zodErrorResponse } from "@/lib/api/server-response";
import { listEstimatesForViewer, saveEstimate } from "@/lib/estimates/estimates.server";
import { EstimateSaveSchema, estimateFailure } from "@/lib/estimates/route-helpers";
import { withSalesViewer } from "@/lib/ghl/sales-route";

/** Admin: every estimate. Rep: their own. */
export const GET = apiRoute(async () => {
  const gate = await withSalesViewer();
  if (gate.error) return gate.error;
  return NextResponse.json(await listEstimatesForViewer(gate.viewer));
});

export const POST = apiRoute(async (request: NextRequest) => {
  const gate = await withSalesViewer();
  if (gate.error) return gate.error;

  const parsed = EstimateSaveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const estimate = await saveEstimate(gate.connection, gate.viewer, null, parsed.data);
    return NextResponse.json(estimate, { status: 201 });
  } catch (error) {
    return estimateFailure(error);
  }
});
