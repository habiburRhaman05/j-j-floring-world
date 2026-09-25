import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { fetchSalesBoard } from "@/lib/ghl/sales-board";
import { salesFailure, withSalesViewer } from "@/lib/ghl/sales-route";

/** The GHL Sales Pipeline: everything for an admin, only their own for a rep. */
export const GET = apiRoute(async () => {
  const gate = await withSalesViewer();
  if (gate.error) return gate.error;

  try {
    return NextResponse.json(await fetchSalesBoard(gate.connection, gate.viewer));
  } catch (error) {
    return salesFailure(error);
  }
});
