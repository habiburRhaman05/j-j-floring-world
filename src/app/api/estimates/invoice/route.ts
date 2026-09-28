import { NextResponse, type NextRequest } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { errorResponse } from "@/lib/api/server-response";
import { withSalesViewer } from "@/lib/ghl/sales-route";
import {
  createAndSendInvoice,
  InvoiceError,
  normalizeTier,
} from "@/lib/estimates/invoice.server";

/**
 * POST /api/estimates/invoice
 *
 * GHL sends estimateId + selectedPackage in the body (not URL params).
 * Creates a GHL invoice from the estimate's line items for the selected
 * package, verifies the total matches, then sends it to the customer.
 *
 * Body: { estimateId: string, selectedPackage: "good" | "better" | "best" }
 *
 * Uses test mode by default (GHL_INVOICE_LIVE_MODE env, defaults false).
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const gate = await withSalesViewer();
  if (gate.error) return gate.error;

  const body = await request.json().catch(() => null);
  if (!body) return errorResponse(400, "Invalid JSON body");

  // ── Validate estimateId ────────────────────────────────────────────
  const estimateId = body.estimateId;
  if (!estimateId || typeof estimateId !== "string") {
    return errorResponse(400, "estimateId is required");
  }

  // ── Validate selectedPackage ────────────────────────────────────────
  const rawTier = body.selectedPackage;
  if (!rawTier || typeof rawTier !== "string") {
    return errorResponse(400, "selectedPackage is required (good, better, or best)");
  }

  const selectedTier = normalizeTier(rawTier);
  if (!selectedTier) {
    return errorResponse(400, `Invalid package: "${rawTier}". Must be good, better, or best.`);
  }

  try {
    const result = await createAndSendInvoice(
      gate.connection,
      gate.viewer,
      estimateId,
      selectedTier,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvoiceError) {
      return errorResponse(error.status, error.message, { code: error.code });
    }
    throw error; // apiRoute catches and returns 500
  }
});
