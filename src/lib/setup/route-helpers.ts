import "server-only";
import type { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/server-response";
import { SetupError } from "./setup.server";

/** A SetupError becomes its own status and message; anything else is rethrown to apiRoute. */
export function setupFailure(error: unknown): NextResponse {
  if (error instanceof SetupError) return errorResponse(error.status, error.message, { code: error.code });
  throw error;
}
