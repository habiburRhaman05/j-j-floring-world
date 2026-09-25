import "server-only";
import {
  getGhlConnection,
  listPipelines,
  searchContactsByTag,
  searchOpportunitiesByPipeline,
  updateOpportunityStage,
  type GhlConnection,
  type GhlContact,
  type GhlOpportunity,
  type GhlPipeline,
} from "./client";
import { GhlNotConfiguredError } from "./leads-sync";
import type {
  CsrBoardOpportunity,
  CsrBoardPipeline,
  CsrFbLeadContact,
} from "@/lib/csr/types";

/* ==========================================================================
   csr-board.ts  -  what the CSR dashboard reads from, and writes back to, GHL
   --------------------------------------------------------------------------
   GHL is the source of truth and its own workflow does the tagging and stage
   moves, so nothing here is stored locally: every call goes to GHL and the
   result is mapped into the plain shapes in lib/csr/types.ts.
   ========================================================================== */

/** The pipeline the front desk works out of unless they pick another. */
const DEFAULT_PIPELINE_NAME = "lead-qualify";

/** A connection is enough here - unlike the older lead board, no pipeline needs to be pre-configured. */
export async function requireConnection(): Promise<GhlConnection> {
  const connection = await getGhlConnection();
  if (!connection) {
    throw new GhlNotConfiguredError("Connect GoHighLevel in Admin -> Sync & Settings first.");
  }
  return connection;
}

function mapPipeline(pipeline: GhlPipeline): CsrBoardPipeline {
  return {
    id: pipeline.id,
    name: pipeline.name,
    stages: [...pipeline.stages]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ id: s.id, name: s.name })),
  };
}

/**
 * lead-qualify when it exists (matched on name, ignoring case and spacing),
 * otherwise the pipeline saved in Sync & Settings, otherwise the first one.
 */
export function pickDefaultPipelineId(
  pipelines: readonly CsrBoardPipeline[],
  configuredId: string | null,
): string | null {
  const wanted = DEFAULT_PIPELINE_NAME.replace(/[\s_-]/g, "");
  const byName = pipelines.find((p) => p.name.toLowerCase().replace(/[\s_-]/g, "") === wanted);
  if (byName) return byName.id;
  if (configuredId && pipelines.some((p) => p.id === configuredId)) return configuredId;
  return pipelines[0]?.id ?? null;
}

export async function fetchBoardPipelines(connection: GhlConnection) {
  const pipelines = (await listPipelines(connection)).map(mapPipeline);
  return {
    locationId: connection.locationId,
    defaultPipelineId: pickDefaultPipelineId(pipelines, connection.leadPipelineId),
    pipelines,
  };
}

export function contactDisplayName(contact: GhlContact): string {
  return (
    contact.name ||
    (contact as { contactName?: string }).contactName ||
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
    "Unnamed contact"
  );
}

function mapOpportunity(opp: GhlOpportunity): CsrBoardOpportunity {
  return {
    id: opp.id,
    name: opp.name,
    contactId: opp.contactId || opp.contact?.id || "",
    contactName: opp.contact?.name || opp.name,
    phone: opp.contact?.phone ?? "",
    email: opp.contact?.email ?? "",
    tags: opp.contact?.tags ?? [],
    stageId: opp.pipelineStageId,
    status: opp.status,
    value: Number(opp.monetaryValue) || 0,
    createdAt: opp.createdAt ?? null,
  };
}

export async function fetchBoardOpportunities(connection: GhlConnection, pipelineId: string) {
  const opportunities = await searchOpportunitiesByPipeline(connection, pipelineId);
  return opportunities.map(mapOpportunity);
}

export async function fetchFbLeadContacts(connection: GhlConnection) {
  const tag = connection.leadTag || "fb-lead";
  const contacts = await searchContactsByTag(connection, tag);
  const mapped: CsrFbLeadContact[] = contacts
    .map((c) => ({
      id: c.id,
      name: contactDisplayName(c),
      phone: c.phone ?? "",
      email: c.email ?? "",
      tags: c.tags ?? [],
      city: (c as { city?: string }).city ?? "",
      postalCode: c.postalCode ?? "",
      dateAdded: c.dateAdded ?? null,
    }))
    // Newest first, so a lead that just arrived is at the top.
    .sort((a, b) => (b.dateAdded ?? "").localeCompare(a.dateAdded ?? ""));
  return { tag, locationId: connection.locationId, contacts: mapped };
}

/** Drag-and-drop lands here: the move is made in GHL, not in a local copy. */
export async function moveOpportunity(
  connection: GhlConnection,
  opportunityId: string,
  pipelineId: string,
  stageId: string,
): Promise<void> {
  await updateOpportunityStage(connection, opportunityId, stageId, pipelineId);
}
