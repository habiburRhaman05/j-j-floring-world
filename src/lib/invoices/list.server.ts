import "server-only";
import type { InvoiceStatus } from "@prisma/client";
import { listGhlInvoices, type GhlInvoiceResponse } from "@/lib/estimates/invoice.server";
import type { GhlConnection } from "@/lib/ghl/client";
import type { Viewer } from "@/lib/ghl/sales-board";
import { prisma } from "@/lib/prisma";
import type { InvoiceDisplayStatus, InvoiceListItem, InvoiceListResponse } from "./types";

const LOCAL_STATUS: Record<InvoiceStatus, InvoiceDisplayStatus> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Sent",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  VOID: "Void",
};

/** GHL's own status wording, plus "overdue" when a sent invoice is past due. */
function ghlStatus(raw: string | undefined, dueAt: Date | null, amountDue: number): InvoiceDisplayStatus | null {
  switch ((raw ?? "").toLowerCase()) {
    case "draft":
      return "Draft";
    case "paid":
      return "Paid";
    case "partially_paid":
      return "Partially paid";
    case "void":
      return "Void";
    case "sent":
    case "payment_processing":
      return dueAt && dueAt.getTime() < Date.now() && amountDue > 0 ? "Overdue" : "Sent";
    default:
      return null;
  }
}

/**
 * GHL invoices this app created, with GHL's live status and amounts on top of
 * the saved copy. A rep only ever receives invoices on their own estimates.
 */
export async function listInvoices(connection: GhlConnection, viewer: Viewer): Promise<InvoiceListResponse> {
  const rows = await prisma.invoice.findMany({
    where: {
      ghlInvoiceId: { not: null },
      ...(viewer.isAdmin ? {} : { estimate: { repId: viewer.userId } }),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      lead: { select: { firstName: true, lastName: true } },
      estimate: { select: { number: true, rep: { select: { firstName: true, lastName: true } } } },
    },
  });

  let live = new Map<string, GhlInvoiceResponse>();
  let notice: string | null = null;
  if (rows.length) {
    try {
      const list = await listGhlInvoices(connection, connection.locationId);
      live = new Map(list.map((inv) => [inv._id, inv] as const));
    } catch {
      notice = "GoHighLevel could not be reached, so these are the last saved statuses.";
    }
  }

  const invoices: InvoiceListItem[] = rows.map((r) => {
    const g = r.ghlInvoiceId ? live.get(r.ghlInvoiceId) : undefined;
    const total = g?.total ?? Number(r.total);
    const amountPaid = g?.amountPaid ?? Number(r.amountPaid);
    const amountDue = g?.amountDue ?? Number(r.amountDue);
    return {
      id: r.id,
      number: g?.invoiceNumber ?? r.number,
      customerName: `${r.lead.firstName} ${r.lead.lastName}`.trim(),
      repName: viewer.isAdmin && r.estimate?.rep ? `${r.estimate.rep.firstName} ${r.estimate.rep.lastName}`.trim() : null,
      estimateNumber: r.estimate?.number ?? null,
      status: (g ? ghlStatus(g.status, r.dueAt, amountDue) : null) ?? LOCAL_STATUS[r.status],
      total,
      amountPaid,
      amountDue,
      issuedAt: r.issuedAt?.toISOString() ?? r.createdAt.toISOString(),
      dueAt: r.dueAt?.toISOString() ?? null,
      url: r.ghlInvoiceUrl,
    };
  });

  return { scope: viewer.isAdmin ? "all" : "own", invoices, notice };
}
