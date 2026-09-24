import "server-only";
import type { NextResponse } from "next/server";
import { getCurrentSession, type CurrentSession } from "./session.server";
import { errorResponse } from "@/lib/api/server-response";

/** Route-handler flavour of requireUser: JSON 401/403 instead of a redirect. */
export async function requireApiUser(
  allowedRoleKeys?: string[],
): Promise<{ session: CurrentSession; error?: undefined } | { session?: undefined; error: NextResponse }> {
  const session = await getCurrentSession();
  if (!session) return { error: errorResponse(401, "Sign in to continue.", { code: "unauthenticated" }) };
  if (allowedRoleKeys && allowedRoleKeys.length > 0) {
    const hasRole = session.roles.some((r) => allowedRoleKeys.includes(r.key));
    if (!hasRole) return { error: errorResponse(403, "You do not have permission to do that.", { code: "forbidden" }) };
  }
  return { session };
}
