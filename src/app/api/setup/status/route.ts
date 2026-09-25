import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/api-route";
import { isSetupComplete } from "@/lib/setup/setup.server";

/** Public: tells the setup and login pages whether first-run setup is still open. */
export const GET = apiRoute(async () =>
  NextResponse.json({
    completed: await isSetupComplete(),
    keyConfigured: Boolean(process.env.SETUP_KEY),
  }),
);
