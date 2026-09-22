import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession, destroyCurrentSession } from "@/lib/auth/session.server";
import { writeAudit, requestMeta } from "@/lib/auth/audit";
import { apiRoute } from "@/lib/api/api-route";

export const POST = apiRoute(async (request: NextRequest) => {
  const session = await getCurrentSession();
  await destroyCurrentSession();

  if (session) {
    const { ipAddress, userAgent } = requestMeta(request);
    await writeAudit({
      actorId: session.user.id,
      action: "auth.logout",
      entity: "User",
      entityId: session.user.id,
      ipAddress,
      userAgent,
    });
  }

  return NextResponse.json({ success: true });
});
