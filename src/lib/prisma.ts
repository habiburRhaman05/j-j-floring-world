/* ==========================================================================
   prisma.ts  -  the Prisma client singleton
   --------------------------------------------------------------------------
   One PrismaClient for the whole server process. In `next dev`, hot-reload
   re-evaluates modules on every change; without this guard each reload opens
   a fresh connection pool and Postgres eventually refuses more. The global
   cache is stripped in production, where the process is long-lived anyway.

   Neon closes idle connections and suspends the compute when nothing is
   happening, so the first query after a quiet spell can find a dead socket
   or wait on a cold start. Errors that mean "the query never reached the
   database" are retried a couple of times with a short backoff instead of
   surfacing as a 500 on sign-in.
   ========================================================================== */

import { Prisma, PrismaClient } from "@prisma/client";

/**
 * P1001 can't reach server, P1002 timed out reaching it, P1017 server closed
 * the connection, P2024 timed out waiting for a pooled connection. In each
 * case the statement did not run, so running it again is safe.
 */
const RETRYABLE_CODES = new Set(["P1001", "P1002", "P1017", "P2024"]);
const MAX_ATTEMPTS = 3;

function isRetryable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return RETRYABLE_CODES.has(error.code);
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return /ConnectionReset|forcibly closed|Connection terminated|Closed/i.test(error.message);
  }
  return false;
}

function createClient() {
  const base = new PrismaClient({
    // "query" logging floods the dev log with every statement; keep it quiet.
    log: ["warn", "error"],
  });

  return base.$extends({
    name: "retry-connection-errors",
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 1; ; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) throw error;
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
          }
        }
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
