import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/* ==========================================================================
   server-response.ts  -  one error/response shape for every route handler
   --------------------------------------------------------------------------
   Matches the body shape `src/lib/api/errors.ts` already parses client-side:
   { message, code?, fields? }. Keeping this separate from that file makes it
   obvious which side of the wire each one belongs to.
   ========================================================================== */

interface FieldError {
  field: string;
  message: string;
}

export function errorResponse(
  status: number,
  message: string,
  opts?: { code?: string; fields?: FieldError[] },
): NextResponse {
  return NextResponse.json({ message, code: opts?.code, fields: opts?.fields }, { status });
}

export function zodErrorResponse(error: ZodError): NextResponse {
  const fields: FieldError[] = error.issues.map((issue) => ({
    field: issue.path.join(".") || "_",
    message: issue.message,
  }));
  return errorResponse(422, "Please correct the highlighted fields.", { code: "validation_error", fields });
}
