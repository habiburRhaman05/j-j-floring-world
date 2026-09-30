import "server-only";
import { prisma } from "@/lib/prisma";
import { estimateInclude, toUiEstimate } from "./estimates.server";
import type { Estimate } from "@/lib/types";

export interface PublicEstimate {
  estimate: Estimate;
  customerName: string;
  customerEmail: string;
  repName: string;
  documentUrl: string | null;
}

/**
 * Loads an estimate by its secret public token, stripping all cost/internal
 * data. Returns null when the token doesn't match or the estimate shouldn't
 * be shown publicly.
 */
export async function loadPublicEstimate(
  token: string,
): Promise<PublicEstimate | null> {
  const row = await prisma.estimate.findUnique({
    where: { publicToken: token },
    include: {
      ...estimateInclude,
      rep: { select: { firstName: true, lastName: true } },
    },
  });

  if (!row) return null;
  // Don't show superseded / void estimates publicly.
  if (row.status === "SUPERSEDED" || row.status === "VOID") return null;

  // Mark as viewed on first public visit (only when it has been sent).
  if (row.status === "SENT" && !row.documentViewedAt) {
    await prisma.$transaction([
      prisma.estimate.update({
        where: { id: row.id },
        data: { documentViewedAt: new Date() },
      }),
      prisma.estimateEvent.create({
        data: { estimateId: row.id, type: "viewed", payload: { via: "web_view" } },
      }),
    ]);
  }

  const estimate = toUiEstimate(row, false); // false = strip cost data

  return {
    estimate,
    customerName: `${row.lead.firstName} ${row.lead.lastName}`.trim(),
    customerEmail: row.lead.email ?? "",
    repName: row.rep
      ? `${row.rep.firstName} ${row.rep.lastName}`.trim()
      : "",
    documentUrl: row.documentUrl ?? null,
  };
}
