import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/api-route";
import { requireApiUser } from "@/lib/auth/require-api-user";
import { zodErrorResponse } from "@/lib/api/server-response";
import { resolveConnection, fetchLiveLeads, pushNewLead, GhlNotConfiguredError } from "@/lib/ghl/leads-sync";
import { errorResponse } from "@/lib/api/server-response";
import type { Lead } from "@/lib/types";

export const GET = apiRoute(async () => {
  const gate = await requireApiUser(["admin", "csr"]);
  if (gate.error) return gate.error;

  let connection;
  try {
    connection = await resolveConnection();
  } catch (error) {
    if (error instanceof GhlNotConfiguredError) return errorResponse(409, error.message, { code: "ghl_not_configured" });
    throw error;
  }

  let leads, contacts;
  try {
    ({ leads, contacts } = await fetchLiveLeads(connection));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error reaching GoHighLevel.";
    return errorResponse(502, message, { code: "ghl_request_failed" });
  }
  return NextResponse.json({
    leads,
    contacts: contacts.map((c) => ({
      id: c.id,
      name: c.name ?? ([c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed contact"),
      phone: c.phone ?? "",
      email: c.email ?? "",
      tags: c.tags ?? [],
      dateAdded: c.dateAdded ?? null,
      inPipeline: leads.some((l) => l.id.startsWith(`${c.id}:`)),
    })),
  });
});

const NewLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  source: z.string().optional(),
  assignedRepId: z.string().optional(),
  note: z.string().optional(),
  by: z.string().optional(),
});

export const POST = apiRoute(async (request: NextRequest) => {
  const gate = await requireApiUser(["admin", "csr"]);
  if (gate.error) return gate.error;

  const json = await request.json().catch(() => null);
  const parsed = NewLeadSchema.safeParse(json);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  let connection;
  try {
    connection = await resolveConnection();
  } catch (error) {
    if (error instanceof GhlNotConfiguredError) return errorResponse(409, error.message, { code: "ghl_not_configured" });
    throw error;
  }

  let leadId: string;
  try {
    leadId = await pushNewLead(connection, parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error reaching GoHighLevel.";
    return errorResponse(502, message, { code: "ghl_request_failed" });
  }

  const { leads } = await fetchLiveLeads(connection);
  const created = leads.find((l) => l.id === leadId);
  const fallback: Lead = {
    id: leadId,
    name: parsed.data.name,
    phone: parsed.data.phone ?? "",
    email: parsed.data.email ?? "",
    zipCode: parsed.data.zipCode ?? "",
    address: parsed.data.address ?? "",
    source: "Facebook Ads",
    assignedRepId: parsed.data.assignedRepId ?? "",
    stage: "New Lead",
    createdAt: new Date().toISOString(),
    appointmentAt: null,
    notes: [],
  };

  return NextResponse.json(created ?? fallback, { status: 201 });
});
