import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/server-response";
import { getGhlConnection, type GhlConnection } from "@/lib/ghl/client";
import { withSalesViewer } from "@/lib/ghl/sales-route";
import type { Viewer } from "@/lib/ghl/sales-board";
import {
  createAndSendInvoice,
  InvoiceError,
  normalizeTier,
} from "@/lib/estimates/invoice.server";

/**
 * POST /api/estimates/invoice
 *
 * Two auth paths:
 *   1. GHL webhook: sends secret via query param (?secret=...) or
 *      x-webhook-secret header (matches GHL_WEBHOOK_SECRET env).
 *   2. App UI: session cookie auth via withSalesViewer()
 *
 * Body: { estimateId: string, selectedPackage: "good" | "better" | "best" }
 * estimateId = the human-facing estimate number, e.g. "EST-2026-0016"
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth: webhook secret OR session cookie ──────────────────────────
    let connection: GhlConnection;
    let viewer: Viewer;

    const envSecret = process.env.GHL_WEBHOOK_SECRET;
    // Accept secret from header OR query parameter (GHL webhooks can't always send headers)
    const webhookSecret =
      request.headers.get("x-webhook-secret") ||
      request.nextUrl.searchParams.get("secret");

    if (webhookSecret && envSecret && webhookSecret === envSecret) {
      // Webhook auth: GHL calling us. Load connection directly.
      const conn = await getGhlConnection();
      if (!conn) {
        return NextResponse.json(
          { error: "GHL not configured" },
          { status: 503 },
        );
      }
      connection = conn;
      // Webhook acts as admin (no specific user session)
      viewer = { userId: "webhook", isAdmin: true, ghlUserId: null };
    } else if (webhookSecret) {
      // Secret was sent but doesn't match
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    } else {
      // Session auth: called from app UI
      const gate = await withSalesViewer();
      if (gate.error) return gate.error;
      connection = gate.connection;
      viewer = gate.viewer;
    }

    // ── Parse body ──────────────────────────────────────────────────────
    const body = await request.json().catch(() => null);
    if (!body) return errorResponse(400, "Invalid JSON body");

    // Log the incoming body for debugging webhook payloads
    console.log("[invoice] Incoming body:", JSON.stringify(body).slice(0, 1000));

    // ── Map GHL custom field names to expected keys ────────────────────
    // GHL webhook sends ALL contact custom fields with their display names
    // as keys (e.g. "Estimate - Number"), not our internal names.
    const estimateId =
      body.estimateId ||
      body["Estimate - Number"] ||
      body["estimate-number"] ||
      body["estimateNumber"];
    if (!estimateId || typeof estimateId !== "string") {
      return errorResponse(400, `estimateId is required. Received keys: ${Object.keys(body).join(", ")}`);
    }

    const rawTier =
      body.selectedPackage ||
      body["selected-package-text"] ||
      body["Selected Option"] ||
      body["selectedOption"];
    if (!rawTier || typeof rawTier !== "string") {
      return errorResponse(400, `selectedPackage is required (good, better, or best). Received keys: ${Object.keys(body).join(", ")}`);
    }

    const selectedTier = normalizeTier(rawTier);
    if (!selectedTier) {
      return errorResponse(400, `Invalid package: "${rawTier}". Must be good, better, or best.`);
    }

    // ── Create and send invoice ─────────────────────────────────────────
    const result = await createAndSendInvoice(
      connection,
      viewer,
      estimateId,
      selectedTier,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvoiceError) {
      return errorResponse(error.status, error.message, { code: error.code });
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Invoice endpoint error:", errMsg, error);
    return NextResponse.json(
      { error: "Failed to create invoice", detail: errMsg },
      { status: 500 },
    );
  }
}
