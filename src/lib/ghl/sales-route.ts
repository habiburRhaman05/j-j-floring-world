import "server-only";
import type { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/server-response";
import { requireApiUser } from "@/lib/auth/require-api-user";
import type { GhlConnection } from "./client";
import { requireConnection } from "./csr-board";
import { ghlFailure } from "./csr-route";
import { GhlNotConfiguredError } from "./leads-sync";
import { SalesBoardError, type Viewer } from "./sales-board";

/** Signed in as admin or sales rep, with GHL connected. Admin sees all; a rep, their own. */
export async function withSalesViewer(): Promise<
  | { connection: GhlConnection; viewer: Viewer; error?: undefined }
  | { connection?: undefined; viewer?: undefined; error: NextResponse }
> {
  const gate = await requireApiUser(["admin", "sales_rep"]);
  if (gate.error) return { error: gate.error };
  const { session } = gate;
  try {
    return {
      connection: await requireConnection(),
      viewer: {
        userId: session.user.id,
        isAdmin: session.roles.some((r) => r.key === "admin"),
        ghlUserId: session.user.ghlUserId,
      },
    };
  } catch (error) {
    if (error instanceof GhlNotConfiguredError) {
      return { error: errorResponse(409, error.message, { code: "ghl_not_configured" }) };
    }
    throw error;
  }
}

export function salesFailure(error: unknown): NextResponse {
  if (error instanceof SalesBoardError) return errorResponse(error.status, error.message, { code: error.code });
  return ghlFailure(error);
}
