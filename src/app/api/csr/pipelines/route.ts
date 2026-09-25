import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { fetchBoardPipelines } from "@/lib/ghl/csr-board";
import { ghlFailure, withCsrConnection } from "@/lib/ghl/csr-route";

/** Every pipeline in the GHL location, with its stages, for the board's select box. */
export const GET = apiRoute(async () => {
  const gate = await withCsrConnection();
  if (gate.error) return gate.error;

  try {
    return NextResponse.json(await fetchBoardPipelines(gate.connection));
  } catch (error) {
    return ghlFailure(error);
  }
});
