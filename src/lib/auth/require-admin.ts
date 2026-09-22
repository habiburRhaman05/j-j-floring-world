import "server-only";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, type CurrentSession } from "./session.server";
import { errorResponse } from "@/lib/api/server-response";

export async function requireAdmin(): Promise<
  { session: CurrentSession; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await getCurrentSession();
  if (!session) return { error: errorResponse(401, "Sign in to continue.", { code: "unauthenticated" }) };
  if (!session.roles.some((r) => r.key === "admin")) {
    return { error: errorResponse(403, "You do not have permission to do that.", { code: "forbidden" }) };
  }
  return { session };
}

/**
 * Doc 04 §8, guard 2: the last ACTIVE user holding the Admin role cannot be
 * suspended, removed, or have the Admin role revoked - otherwise the team
 * locks itself out with no way back in except a database console.
 */
export async function isSoleActiveAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  if (!user || user.status !== "ACTIVE" || user.deletedAt) return false;
  if (!user.roles.some((ur) => ur.role.key === "admin")) return false;

  const activeAdminCount = await prisma.user.count({
    where: { status: "ACTIVE", deletedAt: null, roles: { some: { role: { key: "admin" } } } },
  });
  return activeAdminCount <= 1;
}
