import "server-only";

import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/format";
import {
  ghlFetch,
  type GhlConnection,
} from "@/lib/ghl/client";
import type { Viewer } from "@/lib/ghl/sales-board";
import type { TierLevel } from "@prisma/client";

/* ==========================================================================
   invoice.server.ts  -  Create + send a GHL invoice from an estimate tier
   --------------------------------------------------------------------------
   Called by POST /api/estimates/invoice when GHL sends { estimateId,
   selectedPackage }. Builds the invoice from the estimate's snapshot prices
   (never from live GHL product prices), verifies the total to the cent,
   then emails it to the customer.

   Cost, margin and commission are NEVER sent to GHL.
   ========================================================================== */

// ── GHL Invoice types ─────────────────────────────────────────────────────

export interface GhlInvoiceItem {
  name: string;
  description?: string;
  amount: number; // unit price in dollars
  qty: number;
  currency?: string;
}

export interface GhlAddress {
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface GhlInvoiceCreate {
  altId: string;
  altType: "location";
  name: string;
  title?: string;
  invoiceNumber?: string;
  currency: string;
  issueDate: string;
  dueDate?: string;
  businessDetails: {
    name: string;
    address?: GhlAddress;
    phoneNo?: string;
    email?: string;
    website?: string;
    logoUrl?: string;
    customValues?: string[];
  };
  contactDetails: {
    id?: string;
    name: string;
    email?: string;
    phoneNo?: string;
    address?: GhlAddress;
  };
  items: GhlInvoiceItem[];
  discount?: { value: number; type: "percentage" | "fixed" };
  automaticTaxesEnabled?: boolean;
  sentTo?: { email?: string[]; emailCc?: string[] };
  termsNotes?: string;
  liveMode: boolean;
}

export interface GhlInvoiceSend {
  altId: string;
  altType: "location";
  userId: string;
  action: "email" | "sms" | "sms_and_email" | "send_manually";
  liveMode: boolean;
}

export interface GhlInvoiceResponse {
  _id: string;
  status: string;
  total?: number;
  amountPaid?: number;
  amountDue?: number;
  name?: string;
  invoiceNumber?: string;
}

// ── GHL Invoice API calls (Version: v3) ──────────────────────────────────

async function ghlInvoiceFetch<T>(connection: GhlConnection, path: string, init?: RequestInit): Promise<T> {
  // Invoice API requires Version: v3 instead of the default 2021-07-28.
  // We call ghlFetch but override the Version header.
  const GHL_API_BASE = "https://services.leadconnectorhq.com";
  const response = await fetch(`${GHL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${connection.token}`,
      Version: "v3",
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GHL Invoice API ${response.status}: ${body.slice(0, 400)}`);
  }
  return response.json() as Promise<T>;
}

/** Extract the invoice object from any GHL response shape. */
function extractInvoice(raw: Record<string, unknown>): GhlInvoiceResponse {
  // GHL v3 may return { invoice: {...} }, { data: {...} }, or the invoice at root level
  const inv = (raw.invoice ?? raw.data ?? raw) as GhlInvoiceResponse;
  if (!inv._id && !inv.invoiceNumber) {
    console.error("[invoice] Unexpected GHL response shape:", JSON.stringify(raw).slice(0, 500));
    throw new Error(`GHL returned unexpected response (no _id or invoiceNumber). Keys: ${Object.keys(raw).join(", ")}`);
  }
  return inv;
}

/** Extract the invoices array from a list response. */
function extractInvoiceList(raw: Record<string, unknown>): GhlInvoiceResponse[] {
  const list = (raw.invoices ?? raw.data ?? []) as GhlInvoiceResponse[];
  return Array.isArray(list) ? list : [];
}

async function createGhlInvoice(connection: GhlConnection, data: GhlInvoiceCreate): Promise<GhlInvoiceResponse> {
  const raw = await ghlInvoiceFetch<Record<string, unknown>>(connection, "/invoices/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  console.log("[invoice] createGhlInvoice response keys:", Object.keys(raw));
  return extractInvoice(raw);
}

async function getGhlInvoice(connection: GhlConnection, invoiceId: string, locationId: string): Promise<GhlInvoiceResponse> {
  const params = new URLSearchParams({ altId: locationId, altType: "location" });
  const raw = await ghlInvoiceFetch<Record<string, unknown>>(connection, `/invoices/${invoiceId}?${params}`);
  return extractInvoice(raw);
}

async function sendGhlInvoice(connection: GhlConnection, invoiceId: string, data: GhlInvoiceSend): Promise<GhlInvoiceResponse> {
  const raw = await ghlInvoiceFetch<Record<string, unknown>>(connection, `/invoices/${invoiceId}/send`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return extractInvoice(raw);
}

async function listGhlInvoices(connection: GhlConnection, locationId: string, contactId?: string): Promise<GhlInvoiceResponse[]> {
  const params = new URLSearchParams({ altId: locationId, altType: "location", limit: "100" });
  if (contactId) params.set("contactId", contactId);
  const raw = await ghlInvoiceFetch<Record<string, unknown>>(connection, `/invoices/?${params}`);
  return extractInvoiceList(raw);
}

async function deleteGhlInvoice(connection: GhlConnection, invoiceId: string, locationId: string) {
  const params = new URLSearchParams({ altId: locationId, altType: "location" });
  return ghlInvoiceFetch<unknown>(connection, `/invoices/${invoiceId}?${params}`, { method: "DELETE" });
}

// ── Helpers ───────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dueDateISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

/** Normalize any casing to TierLevel enum value. */
export function normalizeTier(raw: string): TierLevel | null {
  const lower = raw.toLowerCase().trim();
  const map: Record<string, TierLevel> = { good: "GOOD", better: "BETTER", best: "BEST" };
  return map[lower] ?? null;
}

/** Display label for a tier. */
function tierLabel(level: TierLevel): string {
  const labels: Record<TierLevel, string> = { GOOD: "Good", BETTER: "Better", BEST: "Best" };
  return labels[level];
}

function verifyTotal(ghlTotal: number | undefined, expected: number): boolean {
  if (ghlTotal === undefined || ghlTotal === null) return false;
  return Math.abs(round2(ghlTotal) - round2(expected)) < 0.01;
}

// ── Main: create and send invoice ─────────────────────────────────────────

export interface InvoiceResult {
  ok: boolean;
  ghlInvoiceId: string;
  invoiceNumber: string;
  invoiceUrl: string;
  total: number;
  selectedPackage: string;
  liveMode: boolean;
  message: string;
}

export async function createAndSendInvoice(
  connection: GhlConnection,
  viewer: Viewer,
  estimateNumber: string,
  selectedTier: TierLevel,
): Promise<InvoiceResult> {
  // ── Load estimate with tiers and line items ─────────────────────────
  const estimate = await prisma.estimate.findUnique({
    where: { number: estimateNumber },
    include: {
      lead: true,
      tiers: {
        include: { lineItems: true },
      },
    },
  });

  if (!estimate) throw new InvoiceError(404, `Estimate "${estimateNumber}" not found`);

  // ── Access check: rep can only invoice their own estimates ───────────
  if (!viewer.isAdmin && estimate.repId !== viewer.userId) {
    throw new InvoiceError(403, "You can only create invoices for your own estimates");
  }

  // ── Find the selected tier ──────────────────────────────────────────
  const tier = estimate.tiers.find((t) => t.level === selectedTier);
  if (!tier || tier.lineItems.length === 0) {
    throw new InvoiceError(400, `Package "${tierLabel(selectedTier)}" has no items`);
  }

  // ── Check customer has email ────────────────────────────────────────
  if (!estimate.lead.email) {
    throw new InvoiceError(400, "Customer has no email address. Cannot send invoice.");
  }

  // ── Compute totals from snapshot prices ─────────────────────────────
  let subtotal = 0;
  for (const line of tier.lineItems) {
    subtotal += round2(Number(line.unitPrice) * Number(line.quantity));
  }
  subtotal = round2(subtotal);

  // Apply discount if any
  let discountAmount = 0;
  if (tier.discountPercent) {
    discountAmount = round2(subtotal * (Number(tier.discountPercent) / 100));
  } else if (tier.discountAmount) {
    discountAmount = round2(Number(tier.discountAmount));
  }

  const taxRate = Number(estimate.taxRate) || 0;
  const netPrice = round2(subtotal - discountAmount);
  const taxAmount = round2(netPrice * taxRate);
  const expectedTotal = round2(netPrice + taxAmount);

  if (expectedTotal <= 0) throw new InvoiceError(400, "Invoice total must be positive");

  // ── Build GHL invoice payload ───────────────────────────────────────
  const estNum = estimate.number;
  const label = tierLabel(selectedTier);
  const liveMode = process.env.GHL_INVOICE_LIVE_MODE === "true";

  const customerName = `${estimate.lead.firstName} ${estimate.lead.lastName}`.trim();
  const customerAddress: GhlAddress = {
    addressLine1: estimate.lead.addressLine1 || undefined,
    city: estimate.lead.city || undefined,
    state: estimate.lead.state || undefined,
    postalCode: estimate.lead.postalCode || undefined,
    countryCode: "US",
  };

  // Business details from env vars (required by GHL Invoice API v3)
  const businessName = process.env.GHL_BUSINESS_NAME || "J&J Flooring World";
  const businessAddress: GhlAddress = {
    addressLine1: process.env.GHL_BUSINESS_ADDRESS || undefined,
    city: process.env.GHL_BUSINESS_CITY || undefined,
    state: process.env.GHL_BUSINESS_STATE || undefined,
    postalCode: process.env.GHL_BUSINESS_ZIP || undefined,
    countryCode: "US",
  };

  const invoiceItems: GhlInvoiceItem[] = tier.lineItems.map((line) => ({
    name: line.name,
    description: `${Number(line.quantity)} ${line.unit.toLowerCase()}`,
    amount: round2(Number(line.unitPrice)), // unit price
    qty: Number(line.quantity),
    currency: "USD",
  }));

  const termsNotes = [
    `<div style="border-top:1px solid #e0e0e0;padding-top:12px;margin-top:12px;">`,
    `<p style="margin:4px 0;"><strong>Estimate:</strong> ${estNum}</p>`,
    `<p style="margin:4px 0;"><strong>Package:</strong> ${label}</p>`,
    estimate.customerNotes
      ? `<p style="margin:4px 0;"><strong>Notes:</strong> ${estimate.customerNotes}</p>`
      : "",
    `<p style="margin:12px 0 4px 0;font-size:12px;color:#666;">Thank you for choosing J&J Flooring World. Payment is due within 14 days of invoice date.</p>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join("\n");

  const invNumber = estNum.replace("EST-", "INV-");

  const payload: GhlInvoiceCreate = {
    altId: connection.locationId,
    altType: "location",
    name: `${estNum} - ${label} Package`,
    title: `${estNum} - ${label} Package`,
    invoiceNumber: invNumber,
    currency: "USD",
    issueDate: todayISO(),
    dueDate: dueDateISO(),
    businessDetails: {
      name: businessName,
      address: businessAddress,
      phoneNo: process.env.GHL_BUSINESS_PHONE || undefined,
      email: process.env.GHL_BUSINESS_EMAIL || undefined,
      website: process.env.GHL_BUSINESS_WEBSITE || undefined,
      logoUrl: process.env.GHL_BUSINESS_LOGO || undefined,
    },
    contactDetails: {
      id: estimate.lead.ghlContactId || undefined,
      name: customerName,
      email: estimate.lead.email || undefined,
      phoneNo: estimate.lead.phone || undefined,
      address: customerAddress,
    },
    items: invoiceItems,
    discount: discountAmount > 0 ? { value: discountAmount, type: "fixed" } : undefined,
    automaticTaxesEnabled: false,
    sentTo: estimate.lead.email ? { email: [estimate.lead.email] } : undefined,
    termsNotes,
    liveMode,
  };

  // ── Idempotency: check for existing invoice with same name ──────────
  let ghlInvoiceId: string | null = null;
  if (estimate.lead.ghlContactId) {
    try {
      const existingList = await listGhlInvoices(connection, connection.locationId, estimate.lead.ghlContactId);
      const match = existingList.find(
        (inv) => inv.name === payload.name || inv.invoiceNumber === invNumber || inv.invoiceNumber === estNum,
      );
      if (match) {
        ghlInvoiceId = match._id;
      }
    } catch {
      // Non-fatal
    }
  }

  // ── Create invoice as draft if none exists ──────────────────────────
  if (!ghlInvoiceId) {
    const created = await createGhlInvoice(connection, payload);
    ghlInvoiceId = created._id;
  }

  // ── Fetch back and verify total ─────────────────────────────────────
  const fetched = await getGhlInvoice(connection, ghlInvoiceId, connection.locationId);
  if (!verifyTotal(fetched.total, expectedTotal)) {
    try {
      await deleteGhlInvoice(connection, ghlInvoiceId, connection.locationId);
    } catch {
      // best effort cleanup
    }
    throw new InvoiceError(
      422,
      `Invoice total mismatch: expected ${expectedTotal}, GHL returned ${fetched.total}. Draft deleted.`,
    );
  }

  // ── Resolve a valid GHL userId for sending ──────────────────────────
  let sendUserId = viewer.ghlUserId;
  if (!sendUserId) {
    // Webhook call has no ghlUserId. Look up the estimate's sales rep.
    const rep = await prisma.user.findUnique({
      where: { id: estimate.repId },
      select: { ghlUserId: true },
    });
    sendUserId = rep?.ghlUserId ?? null;
  }
  if (!sendUserId) {
    // Last resort: find any user with a ghlUserId in the system
    const anyUser = await prisma.user.findFirst({
      where: { ghlUserId: { not: null } },
      select: { ghlUserId: true },
    });
    sendUserId = anyUser?.ghlUserId ?? null;
  }
  if (!sendUserId) {
    throw new InvoiceError(400, "No GHL user ID found. Cannot send invoice. Ensure sales reps have GHL accounts linked.");
  }

  // ── Send the invoice ────────────────────────────────────────────────
  await sendGhlInvoice(connection, ghlInvoiceId, {
    altId: connection.locationId,
    altType: "location",
    userId: sendUserId,
    action: "email",
    liveMode,
  });

  // ── Save invoice record locally ─────────────────────────────────────
  const snapshotCost = round2(
    tier.lineItems.reduce((sum, l) => sum + round2(Number(l.unitCost) * Number(l.quantity)), 0),
  );

  await prisma.invoice.create({
    data: {
      number: `INV-${estNum.replace("EST-", "")}`,
      leadId: estimate.leadId,
      estimateId: estimate.id,
      ghlInvoiceId,
      ghlInvoiceUrl: `https://app.gohighlevel.com/v2/location/${connection.locationId}/invoices/${ghlInvoiceId}`,
      status: "SENT",
      subtotal: subtotal,
      taxAmount: taxAmount,
      discountAmount: discountAmount,
      total: expectedTotal,
      amountPaid: 0,
      amountDue: expectedTotal,
      snapshotCost,
      depositPercent: estimate.depositPercent,
      depositAmount: round2(expectedTotal * (Number(estimate.depositPercent) / 100)),
    },
  });

  // ── Update estimate status ──────────────────────────────────────────
  await prisma.estimate.update({
    where: { id: estimate.id },
    data: {
      sentTier: selectedTier,
      status: "SENT",
    },
  });

  const invoiceUrl = `https://app.gohighlevel.com/v2/location/${connection.locationId}/invoices/${ghlInvoiceId}`;

  return {
    ok: true,
    ghlInvoiceId,
    invoiceNumber: estNum,
    invoiceUrl,
    total: expectedTotal,
    selectedPackage: label,
    liveMode,
    message: liveMode
      ? `Invoice ${estNum} sent to ${estimate.lead.email}`
      : `Invoice ${estNum} created in TEST MODE and sent to ${estimate.lead.email}`,
  };
}

// ── Error class ───────────────────────────────────────────────────────────

export class InvoiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "invoice_error",
  ) {
    super(message);
    this.name = "InvoiceError";
  }
}
