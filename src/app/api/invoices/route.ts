import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { salesFailure, withSalesViewer } from "@/lib/ghl/sales-route";
import { listInvoices } from "@/lib/invoices/list.server";

/** GHL invoices with live status: an admin sees all, a rep only their own. */
export const GET = apiRoute(async () => {
  const gate = await withSalesViewer();
  if (gate.error) return gate.error;
  try {
    return NextResponse.json(await listInvoices(gate.connection, gate.viewer));
  } catch (error) {
    return salesFailure(error);
  }
});
