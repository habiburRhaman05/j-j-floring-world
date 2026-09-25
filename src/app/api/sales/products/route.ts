import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { fetchPriceBook } from "@/lib/ghl/price-book";
import { salesFailure, withSalesViewer } from "@/lib/ghl/sales-route";

/** The estimate builder's price book: GoHighLevel products and their prices. Prices only, never cost. */
export const GET = apiRoute(async () => {
  const gate = await withSalesViewer();
  if (gate.error) return gate.error;
  try {
    return NextResponse.json({ products: await fetchPriceBook(gate.connection) });
  } catch (error) {
    return salesFailure(error);
  }
});
