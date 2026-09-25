import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/api-route";
import { zodErrorResponse } from "@/lib/api/server-response";
import { requestMeta } from "@/lib/auth/audit";
import { APP_ROLES, assertSetupAllowed, completeSetup } from "@/lib/setup/setup.server";
import { setupFailure } from "@/lib/setup/route-helpers";

const CompleteSchema = z
  .object({
    setupKey: z.string().min(1),
    token: z.string().trim().min(10),
    locationId: z.string().trim().min(5),
    assignments: z
      .array(z.object({ ghlUserId: z.string().min(1), role: z.enum(APP_ROLES as [string, ...string[]]) }))
      .min(1, "Give at least one user an app role."),
  })
  .strict();

/**
 * Step 2: replace every app user with the selected GHL users. The response is
 * the only place the temporary passwords ever appear - they are stored hashed.
 */
export const POST = apiRoute(async (request: NextRequest) => {
  const parsed = CompleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    await assertSetupAllowed(parsed.data.setupKey);
    const result = await completeSetup(
      { token: parsed.data.token, locationId: parsed.data.locationId },
      parsed.data.assignments as { ghlUserId: string; role: (typeof APP_ROLES)[number] }[],
    );
    console.info("[setup] completed from", requestMeta(request).ipAddress ?? "unknown ip");
    return NextResponse.json(
      {
        location: { id: result.location.id, name: result.location.name },
        created: result.created,
        loginUrl: new URL("/login", request.url).toString(),
        backupFile: result.backupFile,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return setupFailure(error);
  }
});
