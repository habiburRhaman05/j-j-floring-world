import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { fetchFbLeadContacts } from "@/lib/ghl/csr-board";
import { ghlFailure, withCsrConnection } from "@/lib/ghl/csr-route";

/** Every GHL contact carrying the fb-lead tag, read live on each request. */
export const GET = apiRoute(async () => {
  const gate = await withCsrConnection();
  if (gate.error) return gate.error;

  try {
    return NextResponse.json(await fetchFbLeadContacts(gate.connection));
  } catch (error) {
    return ghlFailure(error);
  }
});
