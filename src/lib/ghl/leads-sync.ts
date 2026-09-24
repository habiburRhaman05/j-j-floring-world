import "server-only";
import {
  getGhlConnection,
  listPipelines,
  searchContactsByTag,
  searchOpportunitiesByPipeline,
  updateOpportunityStage,
  createContactAndOpportunity,
  addContactNote,
  type GhlConnection,
  type GhlContact,
  type GhlOpportunity,
  type GhlPipeline,
} from "./client";
import { SALES_STAGES } from "@/lib/constants";
import type { Lead, LeadSource, LeadStage } from "@/lib/types";

/* ==========================================================================
   leads-sync.ts  -  the CSR intake board's one seam into GoHighLevel
   --------------------------------------------------------------------------
   No local mirror table yet (Lead in prisma/schema.prisma is designed for
   one and is the natural next step) - today this reads GHL live on every
   request and writes straight back to GHL. `Lead.id` here is a composite
   "<contactId>:<opportunityId>" so a stage change or a note both know which
   GHL records to touch without a second round trip to look them up.
   ========================================================================== */

export class GhlNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GhlNotConfiguredError";
  }
}

export async function resolveConnection(): Promise<GhlConnection> {
  const connection = await getGhlConnection();
  if (!connection) {
    throw new GhlNotConfiguredError("Connect GoHighLevel in Admin -> Sync & Settings first.");
  }
  if (!connection.leadPipelineId) {
    throw new GhlNotConfiguredError(
      "No lead pipeline set. Open Admin -> Sync & Settings and paste the Pipeline ID (from GHL: Opportunities -> Pipelines).",
    );
  }
  return connection;
}

export function makeLeadId(contactId: string, opportunityId: string): string {
  return `${contactId}:${opportunityId}`;
}

export function splitLeadId(id: string): { contactId: string; opportunityId: string } {
  const [contactId, opportunityId] = id.split(":");
  if (!contactId || !opportunityId) {
    throw new Error(`Malformed lead id "${id}".`);
  }
  return { contactId, opportunityId };
}

function contactName(contact: GhlContact): string {
  if (contact.name) return contact.name;
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unnamed contact";
}

function mapStageName(ghlStageName: string): LeadStage {
  const match = (SALES_STAGES as readonly string[]).find(
    (s) => s.toLowerCase() === ghlStageName.trim().toLowerCase(),
  );
  return (match ?? "New Lead") as LeadStage;
}

function mapSource(tag: string): LeadSource {
  if (tag.toLowerCase().includes("fb") || tag.toLowerCase().includes("facebook")) return "Facebook Ads";
  return "Other";
}

export interface LiveLeadsResult {
  leads: Lead[];
  pipeline: GhlPipeline;
  /** Every contact carrying the configured tag, whether or not it has an
   *  opportunity in the pipeline yet - the "all fb-lead contacts" table. */
  contacts: GhlContact[];
}

/**
 * Every contact carrying `connection.leadTag`, joined to its opportunity in
 * `connection.leadPipelineId`. A contact with no opportunity yet in that
 * pipeline is skipped - the board is opportunity-driven, same as the GHL
 * screen it mirrors.
 */
export async function fetchLiveLeads(connection: GhlConnection): Promise<LiveLeadsResult> {
  const tag = connection.leadTag || "fb-lead";
  const pipelineId = connection.leadPipelineId!;

  const [pipelines, contacts, opportunities] = await Promise.all([
    listPipelines(connection),
    searchContactsByTag(connection, tag),
    searchOpportunitiesByPipeline(connection, pipelineId),
  ]);

  const pipeline = pipelines.find((p) => p.id === pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline ${pipelineId} was not found on this GHL location.`);
  }

  const stageNameById = new Map(pipeline.stages.map((s) => [s.id, s.name] as const));
  const contactById = new Map(contacts.map((c) => [c.id, c] as const));

  const opportunitiesByContact = new Map<string, GhlOpportunity>();
  for (const opp of opportunities) {
    if (contactById.has(opp.contactId)) opportunitiesByContact.set(opp.contactId, opp);
  }

  const leads: Lead[] = [];
  for (const contact of contacts) {
    const opportunity = opportunitiesByContact.get(contact.id);
    if (!opportunity) continue; // tagged, but not (yet) in this pipeline

    const stageName = stageNameById.get(opportunity.pipelineStageId) ?? "New Lead";

    leads.push({
      id: makeLeadId(contact.id, opportunity.id),
      name: contactName(contact),
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      zipCode: contact.postalCode ?? "",
      address: contact.address1 ?? "",
      source: mapSource(tag),
      assignedRepId: "",
      stage: mapStageName(stageName),
      createdAt: contact.dateAdded ?? new Date().toISOString(),
      appointmentAt: null,
      notes: [],
    });
  }

  return { leads, pipeline, contacts };
}

/** Drag-and-drop / stage-select lands here: pushes the new stage straight to GHL. */
export async function pushStageChange(
  connection: GhlConnection,
  leadId: string,
  stage: LeadStage,
): Promise<void> {
  const { opportunityId } = splitLeadId(leadId);
  const { pipeline } = await fetchLiveLeads(connection); // cheap enough for today's volume; caches nothing
  const target = pipeline.stages.find((s) => s.name.toLowerCase() === stage.toLowerCase());
  if (!target) {
    throw new Error(`GHL pipeline "${pipeline.name}" has no stage named "${stage}".`);
  }
  await updateOpportunityStage(connection, opportunityId, target.id);
}

export async function pushNewLead(
  connection: GhlConnection,
  input: { name: string; phone?: string; email?: string; address?: string; zipCode?: string },
): Promise<string> {
  const pipelineId = connection.leadPipelineId!;
  const { pipeline } = await fetchLiveLeads(connection).catch(async () => ({
    pipeline: (await listPipelines(connection)).find((p) => p.id === pipelineId)!,
  }));
  const firstStage = pipeline.stages.find((s) => s.name.toLowerCase() === "new lead") ?? pipeline.stages[0];
  if (!firstStage) throw new Error(`GHL pipeline "${pipeline.name}" has no stages.`);

  const { contactId, opportunityId } = await createContactAndOpportunity(connection, {
    ...input,
    pipelineId,
    stageId: firstStage.id,
    tag: connection.leadTag || "fb-lead",
  });
  return makeLeadId(contactId, opportunityId);
}

export async function pushNote(connection: GhlConnection, leadId: string, text: string): Promise<void> {
  const { contactId } = splitLeadId(leadId);
  await addContactNote(connection, contactId, text);
}
