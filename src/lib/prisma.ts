/* ==========================================================================
   prisma.ts  -  the Prisma client singleton
   --------------------------------------------------------------------------
   One PrismaClient for the whole server process. In `next dev`, hot-reload
   re-evaluates modules on every change; without this guard each reload opens
   a fresh connection pool and Postgres eventually refuses more. The global
   cache is stripped in production, where the process is long-lived anyway.
   ========================================================================== */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
