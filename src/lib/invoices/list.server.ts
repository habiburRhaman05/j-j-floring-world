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
  let ghlList: GhlInvoiceResponse[] | null = null;
  let notice: string | null = null;
  // An admin always asks GHL (to see invoices made outside the app); a rep only when they have their own.
  if (viewer.isAdmin || rows.length) {
    try {
      ghlList = await listGhlInvoices(connection, connection.locationId);
      live = new Map(ghlList.map((inv) => [inv._id, inv] as const));
    } catch (error) {
      console.error("[invoices] GHL list failed:", error);
      notice = "GoHighLevel could not be reached, so these are the last saved statuses.";
    }
  }

  // Admin: every GHL invoice, with our saved details attached where we created it.
  if (viewer.isAdmin && ghlList) {
    const saved = new Map(rows.map((r) => [r.ghlInvoiceId, r] as const));
    const invoices: InvoiceListItem[] = ghlList.map((g) => {
      const r = saved.get(g._id);
      const total = Number(g.total ?? r?.total ?? 0);
      const amountPaid = Number(g.amountPaid ?? r?.amountPaid ?? 0);
      const amountDue = Number(g.amountDue ?? r?.amountDue ?? 0);
      const due = g.dueDate ? new Date(g.dueDate) : (r?.dueAt ?? null);
      const issued = g.issueDate ?? g.createdAt ?? null;
      return {
        id: r?.id ?? g._id,
        number: g.invoiceNumber ?? r?.number ?? g.name ?? g._id,
        customerName: r
          ? `${r.lead.firstName} ${r.lead.lastName}`.trim()
          : (g.contactDetails?.name ?? "-"),
        repName: r?.estimate?.rep ? `${r.estimate.rep.firstName} ${r.estimate.rep.lastName}`.trim() : null,
        estimateNumber: r?.estimate?.number ?? null,
        status: ghlStatus(g.status, due && !Number.isNaN(due.getTime()) ? due : null, amountDue) ?? (r ? LOCAL_STATUS[r.status] : "Sent"),
        total,
        amountPaid,
        amountDue,
        issuedAt: issued ? new Date(issued).toISOString() : (r?.issuedAt ?? r?.createdAt)?.toISOString() ?? null,
        dueAt: due && !Number.isNaN(due.getTime()) ? due.toISOString() : null,
        url: r?.ghlInvoiceUrl ?? null,
      };
    });
    invoices.sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? ""));
    return { scope: "all", invoices, notice };
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
