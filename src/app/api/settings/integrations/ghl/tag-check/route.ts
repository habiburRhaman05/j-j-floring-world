import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getGhlConnection, searchContactsByTag } from "@/lib/ghl/client";
import { errorResponse } from "@/lib/api/server-response";
import { apiRoute } from "@/lib/api/api-route";

/** "Does this tag actually exist on any contact" - answered live, not guessed. */
export const GET = apiRoute(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const tag = request.nextUrl.searchParams.get("tag")?.trim();
  if (!tag) return errorResponse(400, "Pass ?tag=", { code: "validation_error" });

  const connection = await getGhlConnection();
  if (!connection) {
    return errorResponse(409, "Connect GoHighLevel (Location ID + token) above first.", {
      code: "ghl_not_configured",
    });
  }

  try {
    const contacts = await searchContactsByTag(connection, tag);
    return NextResponse.json({
      tag,
      count: contacts.length,
      sample: contacts.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name ?? ([c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed contact"),
        tags: c.tags ?? [],
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error reaching GoHighLevel.";
    return errorResponse(502, message, { code: "ghl_request_failed" });
  }
});
