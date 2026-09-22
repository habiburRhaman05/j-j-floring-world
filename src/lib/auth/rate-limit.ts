import "server-only";
import { prisma } from "@/lib/prisma";

/* ==========================================================================
   rate-limit.ts  -  login throttling, backed by the audit trail (NFR-SEC-08)
   --------------------------------------------------------------------------
   Rather than standing up Redis or a bespoke counter table for a 12-user
   internal app, we count `auth.login.failed` rows we are already writing to
   AuditLog. It persists across restarts and works with more than one server
   process, which an in-memory Map would not.
   ========================================================================== */

const MAX_ATTEMPTS_PER_ACCOUNT = 5;
const ACCOUNT_WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_PER_IP = 20;
const IP_WINDOW_MINUTES = 15;

export async function isLoginLocked(email: string, ipAddress: string | null): Promise<boolean> {
  const accountSince = new Date(Date.now() - ACCOUNT_WINDOW_MINUTES * 60_000);
  const accountAttempts = await prisma.auditLog.count({
    where: {
      action: "auth.login.failed",
      entity: "User",
      entityId: email.toLowerCase(),
      createdAt: { gte: accountSince },
    },
  });
  if (accountAttempts >= MAX_ATTEMPTS_PER_ACCOUNT) return true;

  if (ipAddress) {
    const ipSince = new Date(Date.now() - IP_WINDOW_MINUTES * 60_000);
    const ipAttempts = await prisma.auditLog.count({
      where: {
        action: "auth.login.failed",
        ipAddress,
        createdAt: { gte: ipSince },
      },
    });
    if (ipAttempts >= MAX_ATTEMPTS_PER_IP) return true;
  }

  return false;
}
