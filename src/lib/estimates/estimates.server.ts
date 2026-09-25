import "server-only";
import { randomUUID } from "crypto";
import {
  Prisma,
  type EstimateStatus as DbEstimateStatus,
  type LeadStage as DbLeadStage,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { estimateTierTotals } from "@/lib/data/pricing";
import { blankTierMeta } from "@/lib/data/pricing";
import { TIERS } from "@/lib/constants";
import {
  getContact,
  searchOpportunitiesByPipeline,
  type GhlConnection,
  type GhlContact,
  type GhlOpportunity,
} from "@/lib/ghl/client";
import { contactDisplayName } from "@/lib/ghl/csr-board";
import {
  effectiveOwnerGhlId,
  findSalesPipeline,
  repCanSee,
  type Viewer,
} from "@/lib/ghl/sales-board";
import { tierFromDb, tierToDb, unitFromDb, unitToDb } from "@/lib/products/map";
import type {
  Estimate,
  EstimateLine,
  EstimateStatus,
  EstimateTierMeta,
  EstimateTiers,
  Lead,
  LeadStage,
  Tier,
} from "@/lib/types";

/* ==========================================================================
   estimates.server.ts  -  estimates in Postgres, linked to GHL contacts
   --------------------------------------------------------------------------
   The builder picks a customer by GHL contact id. Saving upserts a `Lead`
   row for that contact (ghlContactId), and the estimate hangs off it with
   three EstimateTier rows (Good/Better/Best) and their line items.

   The browser keeps speaking in GHL contact ids: an estimate's `leadId` in
   the API is the lead's ghlContactId when it has one.

   Who may do what:
     admin   any estimate, any customer; the estimate is credited to the
             rep who owns the customer in GHL (else the admin).
     rep     their own estimates, for customers they can see in GHL
             (same rule as the Sales Pipeline).
   Cost never reaches a rep's browser, and a rep's save cannot change it:
   catalog lines take the price-book cost, custom lines cost nothing.

   GHL sync (best effort - the estimate is saved even if GHL refuses):
     send   opportunity value = the Better total (else the largest), stage
            moves to "Estimate Sent" when the pipeline has one
     sign   opportunity value = the accepted package total, status won
   ========================================================================== */

export class EstimateError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "EstimateError";
  }
}

const STATUS_FROM_DB: Record<DbEstimateStatus, EstimateStatus> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  SIGNED: "Signed",
  DECLINED: "Expired",
  EXPIRED: "Expired",
  SUPERSEDED: "Expired",
  VOID: "Expired",
};

const STAGE_FROM_DB: Record<DbLeadStage, LeadStage> = {
  NEW: "New Lead",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  APPOINTMENT_SET: "Appointment Set",
  ESTIMATE_SENT: "Estimate Sent",
  FOLLOW_UP: "Follow-Up",
  WON: "Won",
  LOST: "Lost",
};

export const estimateInclude = {
  lead: true,
  tiers: {
    include: {
      lineItems: {
        include: { product: { include: { category: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  },
} satisfies Prisma.EstimateInclude;

export type EstimateRow = Prisma.EstimateGetPayload<{
  include: typeof estimateInclude;
}>;

/* ---------------------------------------------------------------- mapping */

/** The id the browser uses for a customer: the GHL contact id when there is one. */
export function customerIdOf(lead: {
  id: string;
  ghlContactId: string | null;
}): string {
  return lead.ghlContactId ?? lead.id;
}

export function toUiEstimate(row: EstimateRow, includeCost: boolean): Estimate {
  const tiers: EstimateTiers = { Good: [], Better: [], Best: [] };
  const tierMeta = {
    Good: blankTierMeta(),
    Better: blankTierMeta(),
    Best: blankTierMeta(),
  };

  for (const tier of row.tiers) {
    const key = tierFromDb(tier.level);
    tiers[key] = tier.lineItems.map((li): EstimateLine => ({
      id: li.id,
      productId: li.productId,
      name: li.name,
      description: li.description,
      category: (li.product?.category.name as EstimateLine["category"]) ?? null,
      unit: unitFromDb(li.unit),
      qty: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
      unitCost: includeCost ? Number(li.unitCost) : 0,
      taxable: li.taxable,
      isCustom: li.isCustom,
      ghlProductId: li.ghlProductId,
      ghlPriceId: li.ghlPriceId,
    }));
    tierMeta[key] = {
      label: tier.label,
      summary: tier.summary,
      discountType:
        tier.discountPercent !== null
          ? "percent"
          : tier.discountAmount !== null
            ? "amount"
            : null,
      discountValue: Number(tier.discountPercent ?? tier.discountAmount ?? 0),
      discountReason: includeCost ? tier.discountReason : null,
    };
  }

  return {
    id: row.id,
    number: row.number,
    leadId: customerIdOf(row.lead),
    repId: row.repId,
    createdAt: row.createdAt.toISOString(),
    status: STATUS_FROM_DB[row.status],
    signedAt: row.signedAt?.toISOString() ?? null,
    signedByName: row.signedByName,
    depositPercent: Number(row.depositPercent),
    acceptedTier: row.acceptedTier ? tierFromDb(row.acceptedTier) : null,
    tiers,
    tierMeta,
    customerNotes: row.customerNotes,
    internalNotes: includeCost ? row.internalNotes : null,
    taxRate: Number(row.taxRate) * 100,
    sentTier: row.sentTier ? tierFromDb(row.sentTier) : null,
    customer: {
      name: `${row.lead.firstName} ${row.lead.lastName}`.trim(),
      email: row.lead.email ?? "",
      phone: row.lead.phone ?? "",
    },
  };
}

/** A DB lead in the shape the workspace screens already use. */
export function toUiLead(lead: {
  id: string;
  ghlContactId: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  postalCode: string | null;
  addressLine1: string | null;
  city: string | null;
  source: string;
  assignedRepId: string | null;
  stage: DbLeadStage;
  createdAt: Date;
}): Lead {
  return {
    id: customerIdOf(lead),
    name: `${lead.firstName} ${lead.lastName}`.trim(),
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    zipCode: lead.postalCode ?? "",
    address: [lead.addressLine1, lead.city].filter(Boolean).join(", "),
    source:
      lead.source === "FACEBOOK_ADS"
        ? "Facebook Ads"
        : lead.source === "WEBSITE_FORM"
          ? "Website Form"
          : "Other",
    assignedRepId: lead.assignedRepId ?? "",
    stage: STAGE_FROM_DB[lead.stage],
    createdAt: lead.createdAt.toISOString(),
    appointmentAt: null,
    notes: [],
  };
}

/* ----------------------------------------------------------------- access */

async function salesPipelineOppsFor(
  connection: GhlConnection,
  contactId: string,
): Promise<GhlOpportunity[]> {
  const pipeline = await findSalesPipeline(connection);
  const opps = await searchOpportunitiesByPipeline(connection, pipeline.id, {
    status: "all",
  });
  return opps.filter((o) => (o.contactId || o.contact?.id) === contactId);
}

interface ResolvedCustomer {
  contact: GhlContact;
  /** The Sales Pipeline opportunity for this contact (open first), if any. */
  opportunity: GhlOpportunity | null;
  /** App user the customer belongs to in GHL, if any. */
  ownerUserId: string | null;
}

/** Loads the GHL contact and checks the viewer may quote it. */
async function resolveCustomer(
  connection: GhlConnection,
  viewer: Viewer,
  contactId: string,
): Promise<ResolvedCustomer> {
  const [contact, opps] = await Promise.all([
    getContact(connection, contactId),
    salesPipelineOppsFor(connection, contactId),
  ]);
  if (!contact)
    throw new EstimateError(
      "That customer no longer exists in GoHighLevel.",
      404,
      "customer_missing",
    );

  const opportunity = opps.find((o) => o.status === "open") ?? opps[0] ?? null;

  if (!viewer.isAdmin) {
    const visible =
      (viewer.ghlUserId && contact.assignedTo === viewer.ghlUserId) ||
      opps.some((o) => repCanSee(o, contact.assignedTo, viewer.ghlUserId));
    if (!visible) {
      throw new EstimateError(
        "That customer is not assigned to you in GoHighLevel.",
        403,
        "forbidden",
      );
    }
  }

  const ownerGhl = opportunity
    ? effectiveOwnerGhlId(opportunity, contact.assignedTo)
    : (contact.assignedTo ?? null);
  const owner = ownerGhl
    ? await prisma.user.findFirst({
        where: { ghlUserId: ownerGhl, deletedAt: null },
        select: { id: true },
      })
    : null;
  return { contact, opportunity, ownerUserId: owner?.id ?? null };
}

/** Creates or refreshes the Lead row mirroring a GHL contact. */
async function upsertLeadFromContact(
  customer: ResolvedCustomer,
  repId: string,
) {
  const { contact, opportunity } = customer;
  const name = contactDisplayName(contact);
  const [firstName, ...rest] = name.split(" ");
  const tags = contact.tags ?? [];
  const fromGhl = {
    firstName: contact.firstName || firstName || name,
    lastName: contact.lastName ?? rest.join(" "),
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    addressLine1: contact.address1 ?? null,
    city: (contact as { city?: string }).city ?? null,
    state: (contact as { state?: string }).state ?? null,
    postalCode: contact.postalCode ?? null,
    ghlTags: tags,
    ...(opportunity
      ? {
          ghlOpportunityId: opportunity.id,
          ghlPipelineId: opportunity.pipelineId,
          ghlStageId: opportunity.pipelineStageId,
        }
      : {}),
  };
  return prisma.lead.upsert({
    where: { ghlContactId: contact.id },
    create: {
      ghlContactId: contact.id,
      ...fromGhl,
      source: tags.some((t) => /fb|facebook/i.test(t))
        ? "FACEBOOK_ADS"
        : "OTHER",
      assignedRepId: repId,
      assignedAt: new Date(),
    },
    update: fromGhl,
  });
}

export async function loadForViewer(
  viewer: Viewer,
  estimateId: string,
): Promise<EstimateRow> {
  const row = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: estimateInclude,
  });
  if (!row)
    throw new EstimateError(
      "That estimate no longer exists.",
      404,
      "not_found",
    );
  if (!viewer.isAdmin && row.repId !== viewer.userId) {
    throw new EstimateError(
      "You can only open your own estimates.",
      403,
      "forbidden",
    );
  }
  return row;
}

/* ------------------------------------------------------------------- read */

export async function listEstimatesForViewer(viewer: Viewer) {
  const rows = await prisma.estimate.findMany({
    where: {
      ...(viewer.isAdmin ? {} : { repId: viewer.userId }),
      status: { notIn: ["SUPERSEDED", "VOID"] },
    },
    include: estimateInclude,
    orderBy: { createdAt: "desc" },
  });
  const leads = new Map(rows.map((r) => [r.lead.id, r.lead] as const));
  return {
    estimates: rows.map((r) => toUiEstimate(r, viewer.isAdmin)),
    leads: [...leads.values()].filter((l) => !l.deletedAt).map(toUiLead),
  };
}

export async function getEstimateForViewer(
  viewer: Viewer,
  estimateId: string,
): Promise<Estimate> {
  return toUiEstimate(await loadForViewer(viewer, estimateId), viewer.isAdmin);
}

/* ------------------------------------------------------------------ write */

export interface EstimateSaveInput {
  leadId: string;
  depositPercent: number;
  taxRate: number;
  tiers: EstimateTiers;
  tierMeta?: Record<Tier, EstimateTierMeta>;
  customerNotes?: string | null;
  internalNotes?: string | null;
}

/**
 * An estimate with three packages is a dozen statements against a remote
 * Postgres; Prisma's 5 s default can run out on a slow round trip, so give
 * the save room.
 */
const SAVE_TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

async function nextEstimateNumber(
  tx: Pick<typeof prisma, "estimate">,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EST-${year}-`;
  const last = await tx.estimate.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const seq = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Line items with cost decided server-side for a rep: the price-book cost for
 * a catalog line, zero for a custom line. An admin's typed cost is kept.
 */
async function preparedTiers(input: EstimateSaveInput, isAdmin: boolean) {
  const productIds = TIERS.flatMap((t) =>
    input.tiers[t].map((l) => l.productId),
  ).filter((id): id is string => !!id);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, costPerUnit: true },
  });
  const costOf = new Map(
    products.map((p) => [p.id, Number(p.costPerUnit)] as const),
  );
  const taxRate = input.taxRate;

  const tierRows = [];
  const lineRows = [];
  for (const [index, tier] of TIERS.entries()) {
    const meta = input.tierMeta?.[tier] ?? blankTierMeta();
    const lines = input.tiers[tier].map((l) => ({
      ...l,
      productId: l.productId && costOf.has(l.productId) ? l.productId : null,
      unitCost: isAdmin
        ? Number(l.unitCost) || 0
        : l.productId
          ? (costOf.get(l.productId) ?? 0)
          : 0,
    }));
    const totals = estimateTierTotals(lines, meta, taxRate);
    const hasDiscount = Boolean(meta.discountType) && meta.discountValue > 0;
    const tierId = randomUUID();
    tierRows.push({
      id: tierId,
      level: tierToDb(tier)!,
      label: meta.label?.trim() || null,
      summary: meta.summary?.trim() || null,
      discountPercent:
        hasDiscount && meta.discountType === "percent"
          ? meta.discountValue
          : null,
      discountAmount:
        hasDiscount && meta.discountType === "amount"
          ? meta.discountValue
          : null,
      discountReason: hasDiscount ? meta.discountReason?.trim() || null : null,
      subtotalPrice: totals.subtotalPrice,
      subtotalCost: totals.subtotalCost,
      taxAmount: totals.taxAmount,
      totalPrice: totals.totalPrice,
      sortOrder: index,
    });
    lineRows.push(
      ...lines.map((l, i) => ({
        tierId,
        productId: l.productId,
        name: l.name.trim() || "Item",
        description: l.description?.trim() || null,
        unit: unitToDb(l.unit),
        quantity: Number(l.qty) || 0,
        unitCost: l.unitCost,
        unitPrice: Number(l.unitPrice) || 0,
        taxable: l.taxable,
        // A line drawn from a GHL product is not "custom", even with no catalog row behind it.
        isCustom: l.isCustom || (!l.productId && !l.ghlProductId),
        ghlProductId: l.ghlProductId ?? null,
        ghlPriceId: l.ghlPriceId ?? null,
        sortOrder: i,
      })),
    );
  }
  return { tierRows, lineRows };
}

export async function saveEstimate(
  connection: GhlConnection,
  viewer: Viewer,
  estimateId: string | null,
  input: EstimateSaveInput,
): Promise<Estimate> {
  const existing = estimateId ? await loadForViewer(viewer, estimateId) : null;
  if (existing && existing.status === "SIGNED") {
    throw new EstimateError(
      "A signed estimate can't be changed.",
      409,
      "estimate_signed",
    );
  }

  // Changing the customer on an existing estimate re-checks access; keeping it does not re-ask GHL.
  let leadId: string;
  let repId: string;
  if (existing && customerIdOf(existing.lead) === input.leadId) {
    leadId = existing.leadId;
    repId = existing.repId;
  } else {
    const customer = await resolveCustomer(connection, viewer, input.leadId);
    repId = viewer.isAdmin
      ? (customer.ownerUserId ?? viewer.userId)
      : viewer.userId;
    leadId = (await upsertLeadFromContact(customer, repId)).id;
  }

  // A rep's save carries no internal notes or discount reasons (never sent to them); keep what is stored.
  const keepPrivate = !viewer.isAdmin && existing;
  const { tierRows, lineRows } = await preparedTiers(input, viewer.isAdmin);
  if (keepPrivate) {
    for (const t of tierRows) {
      t.discountReason =
        existing.tiers.find((x) => x.level === t.level)?.discountReason ??
        t.discountReason;
    }
  }

  const common = {
    leadId,
    repId,
    depositPercent: Math.min(Math.max(input.depositPercent, 0), 100),
    taxRate: Math.max(input.taxRate, 0) / 100,
    customerNotes: input.customerNotes?.trim() || null,
    internalNotes: keepPrivate
      ? existing.internalNotes
      : input.internalNotes?.trim() || null,
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Every tier and every line go in with one statement each (ids made
      // here), so a save costs a handful of round trips however many lines.
      const saved = await prisma.$transaction(async (tx) => {
        let id: string;
        if (existing) {
          id = existing.id;
          await tx.estimateTier.deleteMany({ where: { estimateId: id } });
          await tx.estimate.update({ where: { id }, data: common });
        } else {
          id = (
            await tx.estimate.create({
              data: { ...common, number: await nextEstimateNumber(tx) },
            })
          ).id;
        }
        await tx.estimateTier.createMany({
          data: tierRows.map((t) => ({ ...t, estimateId: id })),
        });
        if (lineRows.length)
          await tx.estimateLineItem.createMany({ data: lineRows });
        await tx.estimateEvent.create({
          data: {
            estimateId: id,
            type: existing ? "updated" : "created",
            actorId: viewer.userId,
          },
        });
        return id;
      }, SAVE_TX_OPTIONS);
      return getEstimateForViewer(viewer, saved);
    } catch (error) {
      // Two estimates created at the same moment can race for a number; take the next one.
      const numberClash =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        !existing;
      if (!numberClash || attempt === 2) throw error;
    }
  }
  throw new EstimateError(
    "Could not number the estimate. Try again.",
    409,
    "number_conflict",
  );
}

/* ------------------------------------------------------------- lifecycle */

export function tierTotal(
  row: EstimateRow,
  level: "GOOD" | "BETTER" | "BEST",
): number {
  return Number(row.tiers.find((t) => t.level === level)?.totalPrice ?? 0);
}

/** The Sales Pipeline opportunity for an estimate's customer, remembered on the lead. */
export async function opportunityFor(
  connection: GhlConnection,
  row: EstimateRow,
): Promise<GhlOpportunity | null> {
  if (!row.lead.ghlContactId) return null;
  const opps = await salesPipelineOppsFor(connection, row.lead.ghlContactId);
  const opp =
    opps.find((o) => o.id === row.lead.ghlOpportunityId) ??
    opps.find((o) => o.status === "open") ??
    opps[0] ??
    null;
  if (opp && opp.id !== row.lead.ghlOpportunityId) {
    await prisma.lead.update({
      where: { id: row.lead.id },
      data: { ghlOpportunityId: opp.id, ghlPipelineId: opp.pipelineId },
    });
  }
  return opp;
}

/** Runs a GHL write; a failure becomes a warning for the response, never a failed save. */
export async function bestEffort(
  label: string,
  run: () => Promise<void>,
): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    console.error(`[estimates] GHL ${label} failed:`, error);
    return `Saved, but GoHighLevel was not updated (${label}).`;
  }
}
