import "server-only";
import { prisma } from "@/lib/prisma";

/* ==========================================================================
   audit.ts  -  one write path for AuditLog rows (FR-SYS-03 / doc03 rule R5)
   --------------------------------------------------------------------------
   Every mutation in the auth surface goes through this so the shape of an
   audit row never drifts between call sites.
   ========================================================================== */

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  syncSource?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? undefined : (input.before as object),
      after: input.after === undefined ? undefined : (input.after as object),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      syncSource: input.syncSource ?? null,
    },
  });
}

/** Pulls the caller's IP and user agent off a standard Request/NextRequest. */
export function requestMeta(request: Request): { ipAddress: string | null; userAgent: string | null } {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0]!.trim() : null;
  const userAgent = request.headers.get("user-agent");
  return { ipAddress, userAgent };
}
