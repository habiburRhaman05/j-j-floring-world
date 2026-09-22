import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session.server";
import { serializeSessionUser } from "@/lib/auth/serialize";
import { apiRoute } from "@/lib/api/api-route";

/** Powers "show session data that currently exists" in the header/session provider. */
export const GET = apiRoute(async () => {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({ user: serializeSessionUser(session.user, session.roles) });
});
