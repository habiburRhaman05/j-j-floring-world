import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/api-route";
import { zodErrorResponse } from "@/lib/api/server-response";
import { TIERS } from "@/lib/constants";
import { EstimateDocumentError } from "@/lib/estimates/ghl-document.server";
import { sendEstimate } from "@/lib/estimates/lifecycle.server";
import { estimateFailure } from "@/lib/estimates/route-helpers";
import { errorResponse } from "@/lib/api/server-response";
import { withSalesViewer } from "@/lib/ghl/sales-route";

const SendSchema = z.object({ tier: z.enum(TIERS) });

/**
 * Emails the customer the GHL estimate document for one package. The rep
 * has confirmed the recipient in the app before this is called; nothing is
 * ever sent automatically.
 */
export const POST = apiRoute(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const gate = await withSalesViewer();
  if (gate.error) return gate.error;

  const parsed = SendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const { estimate, warning } = await sendEstimate(gate.connection, gate.viewer, (await params).id, parsed.data.tier);
    return NextResponse.json({ ...estimate, warning });
  } catch (error) {
    if (error instanceof EstimateDocumentError) return errorResponse(error.status, error.message, { code: error.code });
    return estimateFailure(error);
  }
});
