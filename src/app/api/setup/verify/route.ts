import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/api-route";
import { zodErrorResponse } from "@/lib/api/server-response";
import { assertSetupAllowed, verifyGhlCredentials } from "@/lib/setup/setup.server";
import { setupFailure } from "@/lib/setup/route-helpers";

const VerifySchema = z
  .object({
    setupKey: z.string().min(1, "Enter the setup key."),
    token: z.string().trim().min(10, "Paste the GHL Private Integration token."),
    locationId: z.string().trim().min(5, "Enter the GHL Location ID."),
  })
  .strict();

/** Step 1: check the key and the GHL credentials, and list the sub-account's users. Saves nothing. */
export const POST = apiRoute(async (request: NextRequest) => {
  const parsed = VerifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    await assertSetupAllowed(parsed.data.setupKey);
    const { location, users, ownerGhlUserId, ownerDetectedBy } = await verifyGhlCredentials(parsed.data);
    return NextResponse.json({
      location: { id: location.id, name: location.name },
      users,
      ownerGhlUserId,
      ownerDetectedBy,
    });
  } catch (error) {
    return setupFailure(error);
  }
});
