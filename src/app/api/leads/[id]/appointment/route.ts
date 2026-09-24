import { NextRequest } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { requireApiUser } from "@/lib/auth/require-api-user";
import { errorResponse } from "@/lib/api/server-response";

/**
 * Not built yet: booking needs the GHL Calendars API (a different surface
 * than Opportunities/Contacts), deliberately out of today's CSR-intake slice.
 * Returns a clear error instead of silently pretending to succeed.
 */
export const PUT = apiRoute(async (_request: NextRequest) => {
  const gate = await requireApiUser(["admin", "csr"]);
  if (gate.error) return gate.error;

  return errorResponse(501, "Appointment booking isn't wired to GHL Calendars yet.", {
    code: "not_implemented",
  });
});
