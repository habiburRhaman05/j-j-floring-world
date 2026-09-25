import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { syncEstimateDocuments } from "@/lib/estimates/lifecycle.server";
import { estimateFailure } from "@/lib/estimates/route-helpers";
import { withSalesViewer } from "@/lib/ghl/sales-route";

/** Checks GHL for signed or opened estimate documents ("Check for signatures"). */
export const POST = apiRoute(async () => {
  const gate = await withSalesViewer();
  if (gate.error) return gate.error;
  try {
    return NextResponse.json({ changed: await syncEstimateDocuments(gate.connection, gate.viewer) });
  } catch (error) {
    return estimateFailure(error);
  }
});
