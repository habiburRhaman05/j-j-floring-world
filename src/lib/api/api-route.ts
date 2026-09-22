import "server-only";
import type { NextResponse } from "next/server";
import { errorResponse } from "./server-response";

/* ==========================================================================
   api-route.ts  -  catch-all so a bug never surfaces as an opaque 500
   --------------------------------------------------------------------------
   Without this, an unhandled exception in a route handler falls through to
   Next's own default error response, which does not match the
   { message, code, fields } shape src/lib/api/errors.ts expects - so the
   client shows a generic, unhelpful failure instead of a real message. Every
   route wraps its handler in this so the failure mode is always a parseable,
   readable error, and the real cause still lands in the server log.
   ========================================================================== */

export function apiRoute<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("[api] unhandled error:", error);
      return errorResponse(500, "Something went wrong on our end. Please try again in a moment.", {
        code: "internal_error",
      });
    }
  };
}
