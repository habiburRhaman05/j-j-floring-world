import "server-only";
import type { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/server-response";
import { requireApiUser } from "@/lib/auth/require-api-user";
import type { GhlConnection } from "./client";
import { requireConnection } from "./csr-board";
import { GhlNotConfiguredError } from "./leads-sync";

/**
 * The gate every CSR route shares: signed in as admin or CSR, GHL connected.
 * A GHL failure is reported as 502 with GHL's own message so the dashboard can
 * say what actually went wrong instead of a generic error.
 */
export async function withCsrConnection(): Promise<
  { connection: GhlConnection; error?: undefined } | { connection?: undefined; error: NextResponse }
> {
  const gate = await requireApiUser(["admin", "csr"]);
  if (gate.error) return { error: gate.error };
  try {
    return { connection: await requireConnection() };
  } catch (error) {
    if (error instanceof GhlNotConfiguredError) {
      return { error: errorResponse(409, error.message, { code: "ghl_not_configured" }) };
    }
    throw error;
  }
}

/**
 * A GoHighLevel refusal ("GHL 4xx on /path: ...") is shown as-is, so the
 * user can see what GHL objected to. Anything else - a database error, a bug -
 * is rethrown to apiRoute, which logs it and answers with a plain message,
 * so internals never reach the screen.
 */
export function ghlFailure(error: unknown): NextResponse {
  if (error instanceof Error && /^GHL \d{3} /.test(error.message)) {
    return errorResponse(502, error.message, { code: "ghl_request_failed" });
  }
  throw error;
}
