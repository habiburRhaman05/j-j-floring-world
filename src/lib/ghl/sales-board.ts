import "server-only";
import { prisma } from "@/lib/prisma";
import {
  getContact,
  getOpportunity,
  listAllContacts,
  listLocationUsers,
  listPipelines,
  searchOpportunitiesByPipeline,
  updateOpportunityStage,
  type GhlConnection,
  type GhlOpportunity,
  type GhlPipeline,
} from "./client";
import { contactDisplayName } from "./csr-board";
import { readRates } from "@/lib/sales/rates.server";
import type {
  SalesAssignedContact,
  SalesBoardResponse,
  SalesOpportunity,
  SalesRep,
} from "@/lib/sales/types";

/* ==========================================================================
   sales-board.ts  -  GHL's "Sales Pipeline", for the admin and rep dashboards
   --------------------------------------------------------------------------
   Read live from GHL on every request, every status (open, won, lost,
   abandoned). An admin sees everything; a rep only ever receives their own
   records - the filtering happens here, never in the browser.

   Who a deal belongs to. In GHL the opportunity "Owner" is frequently left
   Unassigned while the lead (the contact) is assigned to the rep, so:
     owner   = opportunity owner, else the contact's assigned user,
               else the first follower
     visible = a rep sees a deal they own, or one they follow
   The owner is who the deal counts for (revenue, commission). GHL user ids
   map to app users through User.ghlUserId, set at setup.
   ========================================================================== */

const SALES_PIPELINE_NAME = "salespipeline";

export class SalesBoardError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "SalesBoardError";
  }
}

export async function findSalesPipeline(connection: GhlConnection): Promise<GhlPipeline> {
  const pipelines = await listPipelines(connection);
  const pipeline = pipelines.find(
    (p) => p.name.toLowerCase().replace(/[\s_-]/g, "") === SALES_PIPELINE_NAME,
  );
  if (!pipeline) {
    throw new SalesBoardError(
      'GoHighLevel has no pipeline named "Sales Pipeline" on this location.',
      404,
      "sales_pipeline_missing",
    );
  }
  return pipeline;
}

/** The GHL user a deal counts for. */
export function effectiveOwnerGhlId(
  opportunity: Pick<GhlOpportunity, "assignedTo" | "followers">,
  contactAssignedTo: string | null | undefined,
): string | null {
  return opportunity.assignedTo || contactAssignedTo || opportunity.followers?.[0] || null;
}

/** Whether a rep may see (and move) this deal: they own it, or they follow it. */
export function repCanSee(
  opportunity: Pick<GhlOpportunity, "assignedTo" | "followers">,
  contactAssignedTo: string | null | undefined,
  ghlUserId: string | null,
): boolean {
  if (!ghlUserId) return false;
  return (
    effectiveOwnerGhlId(opportunity, contactAssignedTo) === ghlUserId ||
    (opportunity.followers ?? []).includes(ghlUserId)
  );
}

export interface Viewer {
  userId: string;
  isAdmin: boolean;
  ghlUserId: string | null;
}

export async function fetchSalesBoard(connection: GhlConnection, viewer: Viewer): Promise<SalesBoardResponse> {
  const [pipeline, contacts, ghlUsers, appUsers, rates] = await Promise.all([
    findSalesPipeline(connection),
    listAllContacts(connection),
    listLocationUsers(connection).catch(() => []),
    prisma.user.findMany({
      where: { deletedAt: null, ghlUserId: { not: null } },
      select: { id: true, firstName: true, lastName: true, ghlUserId: true, role: true },
    }),
    readRates(),
  ]);
  const opportunities = await searchOpportunitiesByPipeline(connection, pipeline.id, { status: "all" });

  const appByGhl = new Map(appUsers.map((u) => [u.ghlUserId!, u] as const));
  const ghlNameById = new Map(
    ghlUsers.map(
      (u) =>
        [u.id, u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id] as const,
    ),
  );

  const ownerOf = (ghlId: string | null | undefined) => {
    if (!ghlId) return { ownerUserId: null, ownerName: "Unassigned" };
    const app = appByGhl.get(ghlId);
    if (app) return { ownerUserId: app.id, ownerName: `${app.firstName} ${app.lastName}`.trim() };
    return { ownerUserId: null, ownerName: ghlNameById.get(ghlId) ?? "Unknown GHL user" };
  };

  const contactAssignee = new Map(contacts.map((c) => [c.id, c.assignedTo ?? null] as const));
  const contactOf = (o: GhlOpportunity) => contactAssignee.get(o.contactId || o.contact?.id || "");

  const visible = viewer.isAdmin
    ? opportunities
    : opportunities.filter((o) => repCanSee(o, contactOf(o), viewer.ghlUserId));

  const mapped: SalesOpportunity[] = visible.map((o) => {
    const status = (o.status || "open").toLowerCase();
    const ownerGhlId = effectiveOwnerGhlId(o, contactOf(o));
    return {
      id: o.id,
      name: o.name,
      contactId: o.contactId || o.contact?.id || "",
      contactName: o.contact?.name || o.name,
      phone: o.contact?.phone ?? "",
      email: o.contact?.email ?? "",
      tags: o.contact?.tags ?? [],
      stageId: o.pipelineStageId,
      status,
      value: Number(o.monetaryValue) || 0,
      createdAt: o.createdAt ?? null,
      updatedAt: o.updatedAt ?? null,
      closedAt: status === "open" ? null : (o.lastStatusChangeAt ?? o.updatedAt ?? null),
      source: o.source ?? null,
      assignedToGhlId: ownerGhlId,
      ...ownerOf(ownerGhlId),
    };
  });

  // Contacts assigned to someone in the app who have no card in this pipeline yet.
  const inPipeline = new Set(opportunities.map((o) => o.contactId || o.contact?.id));
  const assignedContacts: SalesAssignedContact[] = contacts
    .filter((c) => c.assignedTo && !inPipeline.has(c.id))
    .filter((c) => (viewer.isAdmin ? appByGhl.has(c.assignedTo!) : c.assignedTo === viewer.ghlUserId))
    .map((c) => ({
      id: c.id,
      name: contactDisplayName(c),
      phone: c.phone ?? "",
      email: c.email ?? "",
      tags: c.tags ?? [],
      dateAdded: c.dateAdded ?? null,
      ...ownerOf(c.assignedTo),
    }))
    .sort((a, b) => (b.dateAdded ?? "").localeCompare(a.dateAdded ?? ""));

  const reps: SalesRep[] = appUsers
    .filter((u) => (viewer.isAdmin ? u.role === "sales_rep" : u.id === viewer.userId))
    .map((u) => ({ userId: u.id, name: `${u.firstName} ${u.lastName}`.trim(), ghlUserId: u.ghlUserId }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    scope: viewer.isAdmin ? "all" : "own",
    locationId: connection.locationId,
    pipeline: {
      id: pipeline.id,
      name: pipeline.name,
      stages: [...pipeline.stages]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ id: s.id, name: s.name })),
    },
    reps,
    opportunities: mapped,
    assignedContacts,
    rates: viewer.isAdmin
      ? rates
      : {
          defaultCommissionPercent: rates.defaultCommissionPercent,
          marginPercent: null,
          repCommissionPercent:
            viewer.userId in rates.repCommissionPercent
              ? { [viewer.userId]: rates.repCommissionPercent[viewer.userId]! }
              : {},
        },
    notice:
      !viewer.isAdmin && !viewer.ghlUserId
        ? "Your account is not linked to a GoHighLevel user, so no leads can be matched to you. Ask an admin."
        : null,
  };
}

/**
 * Moves a card to another Sales Pipeline stage in GHL. A rep may only move
 * their own cards; the owner is read from GHL at the moment of the change,
 * not trusted from the browser.
 */
export async function moveSalesOpportunity(
  connection: GhlConnection,
  viewer: Viewer,
  opportunityId: string,
  stageId: string,
): Promise<void> {
  const pipeline = await findSalesPipeline(connection);
  if (!pipeline.stages.some((s) => s.id === stageId)) {
    throw new SalesBoardError("That stage is not part of the Sales Pipeline.", 422, "stage_invalid");
  }

  const opportunity = await getOpportunity(connection, opportunityId);
  if (!opportunity || opportunity.pipelineId !== pipeline.id) {
    throw new SalesBoardError("That opportunity is not in the Sales Pipeline any more.", 404, "not_found");
  }
  if (!viewer.isAdmin) {
    const contact = opportunity.contactId ? await getContact(connection, opportunity.contactId) : null;
    if (!repCanSee(opportunity, contact?.assignedTo, viewer.ghlUserId)) {
      throw new SalesBoardError("You can only move opportunities assigned to you.", 403, "forbidden");
    }
  }

  await updateOpportunityStage(connection, opportunityId, stageId, pipeline.id);
}
