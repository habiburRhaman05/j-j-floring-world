import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";

/* ==========================================================================
   client.ts  -  GoHighLevel API access
   --------------------------------------------------------------------------
   Best-effort implementation. Doc 05 §8 (risk R1) flags that GHL's exact API
   surface is unverified pending the week-one integration spike; the endpoint
   paths and header names below are GHL's documented v2 API conventions, not
   yet confirmed against this location's live account. Expect to adjust
   `verifyConnection` and `uploadMedia` once real credentials are tested.
   ========================================================================== */

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";
const PROVIDER = "gohighlevel";

export interface GhlConnection {
  locationId: string;
  token: string;
  leadPipelineId: string | null;
  leadTag: string;
}

export async function getGhlConnection(): Promise<GhlConnection | null> {
  const credential = await prisma.integrationCredential.findUnique({
    where: { provider: PROVIDER },
  });
  if (!credential || !credential.locationId) return null;
  return {
    locationId: credential.locationId,
    token: decryptSecret(credential.encryptedToken),
    leadPipelineId: credential.leadPipelineId ?? null,
    leadTag: credential.leadTag ?? "fb-lead",
  };
}

export async function saveGhlConnection(
  locationId: string,
  token: string,
  connectedById: string,
  leadConfig?: { leadPipelineId?: string | null; leadTag?: string | null },
): Promise<void> {
  await prisma.integrationCredential.upsert({
    where: { provider: PROVIDER },
    create: {
      provider: PROVIDER,
      locationId,
      encryptedToken: encryptSecret(token),
      encryptionKeyId: "env:ENCRYPTION_KEY",
      connectedAt: new Date(),
      connectedById,
      leadPipelineId: leadConfig?.leadPipelineId ?? null,
      leadTag: leadConfig?.leadTag ?? "fb-lead",
    },
    update: {
      locationId,
      encryptedToken: encryptSecret(token),
      connectedAt: new Date(),
      connectedById,
      lastVerifiedAt: null,
      lastVerifyError: null,
      ...(leadConfig?.leadPipelineId !== undefined ? { leadPipelineId: leadConfig.leadPipelineId } : {}),
      ...(leadConfig?.leadTag !== undefined ? { leadTag: leadConfig.leadTag ?? "fb-lead" } : {}),
    },
  });
}

/** Saves only the lead-sync config (pipeline + tag) without touching the token. */
export async function saveGhlLeadConfig(leadPipelineId: string, leadTag: string): Promise<void> {
  await prisma.integrationCredential.update({
    where: { provider: PROVIDER },
    data: { leadPipelineId, leadTag: leadTag || "fb-lead" },
  });
}

/** GET /locations/:id with the stored bearer token. Never throws; reports success/failure. */
export async function verifyConnection(): Promise<{ ok: boolean; error?: string }> {
  const connection = await getGhlConnection();
  if (!connection) return { ok: false, error: "No GoHighLevel connection is saved yet." };

  try {
    const response = await fetch(`${GHL_API_BASE}/locations/${connection.locationId}`, {
      headers: {
        Authorization: `Bearer ${connection.token}`,
        Version: GHL_API_VERSION,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `GHL returned ${response.status}: ${body.slice(0, 300)}` };
    }

    await prisma.integrationCredential.update({
      where: { provider: PROVIDER },
      data: { lastVerifiedAt: new Date(), lastVerifyError: null },
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error contacting GHL.";
    await prisma.integrationCredential
      .update({ where: { provider: PROVIDER }, data: { lastVerifyError: message } })
      .catch(() => {});
    return { ok: false, error: message };
  }
}

/**
 * Uploads a file to GHL's media library and returns the URL GHL stores it at.
 * Used for avatar uploads (decision: no local/S3 storage in this pass, GHL
 * media storage is the file host per the user's explicit instruction).
 */
export async function uploadMedia(file: Blob, filename: string): Promise<{ url: string; id: string }> {
  const connection = await getGhlConnection();
  if (!connection) {
    throw new Error("Connect GoHighLevel in Settings before uploading files.");
  }

  const form = new FormData();
  form.append("file", file, filename);

  const response = await fetch(`${GHL_API_BASE}/medias/upload-file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.token}`,
      Version: GHL_API_VERSION,
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GHL media upload failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { url?: string; fileId?: string; id?: string };
  const url = data.url;
  const id = data.fileId ?? data.id;
  if (!url || !id) {
    throw new Error("GHL media upload returned an unexpected response shape.");
  }
  return { url, id };
}


/* ==========================================================================
   Pipelines, opportunities and contacts - the CSR intake board and the
   assignment flow run entirely on these. Same "best-effort" caveat as above:
   paths follow GHL's documented v2 conventions, adjust if the live account
   responds differently.
   ========================================================================== */

export interface GhlPipelineStage {
  id: string;
  name: string;
  position: number;
}

export interface GhlPipeline {
  id: string;
  name: string;
  stages: GhlPipelineStage[];
}

export async function ghlFetch<T>(connection: GhlConnection, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GHL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${connection.token}`,
      Version: GHL_API_VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GHL ${response.status} on ${path}: ${body.slice(0, 400)}`);
  }
  return response.json() as Promise<T>;
}

/** GET /opportunities/pipelines - every pipeline for this location, with its stages. */
export async function listPipelines(connection: GhlConnection): Promise<GhlPipeline[]> {
  const data = await ghlFetch<{ pipelines: GhlPipeline[] }>(
    connection,
    `/opportunities/pipelines?locationId=${encodeURIComponent(connection.locationId)}`,
  );
  return data.pipelines ?? [];
}

export interface GhlOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  monetaryValue?: number;
  contactId: string;
  createdAt?: string;
  updatedAt?: string;
  contact?: { id?: string; name?: string; email?: string; phone?: string; tags?: string[] };
}

/**
 * GET /opportunities/search - every opportunity in one pipeline.
 *
 * GHL caps a page at 100, so this walks pages until one comes back short (or
 * the reported total is reached) instead of silently dropping the rest.
 * `status` defaults to "open", which is what GHL's own board shows under
 * "Open opportunities".
 */
export async function searchOpportunitiesByPipeline(
  connection: GhlConnection,
  pipelineId: string,
  options: { status?: "open" | "won" | "lost" | "abandoned" | "all" } = {},
): Promise<GhlOpportunity[]> {
  const LIMIT = 100;
  const MAX_PAGES = 30; // 3,000 opportunities in one pipeline
  const all: GhlOpportunity[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      location_id: connection.locationId,
      pipeline_id: pipelineId,
      status: options.status ?? "open",
      limit: String(LIMIT),
      page: String(page),
    });
    const data = await ghlFetch<{ opportunities: GhlOpportunity[]; meta?: { total?: number } }>(
      connection,
      `/opportunities/search?${params.toString()}`,
    );
    const batch = data.opportunities ?? [];
    all.push(...batch);
    if (batch.length < LIMIT) break;
    if (data.meta?.total !== undefined && all.length >= data.meta.total) break;
  }

  // A page boundary can repeat a row when something moves mid-walk.
  return [...new Map(all.map((o) => [o.id, o] as const)).values()];
}

export interface GhlContact {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  address1?: string;
  postalCode?: string;
  tags?: string[];
  dateAdded?: string;
  source?: string;
}

/**
 * Every contact carrying a given tag (e.g. "fb-lead").
 *
 * GHL's POST /contacts/search "filters" DSL is thinly documented and did not
 * match tags reliably against a live account (confirmed: a contact visibly
 * tagged "fb-lead" in the GHL UI came back as zero results). Fetching pages
 * of contacts and filtering by tag ourselves, case-insensitively, is slower
 * but correct - no dependency on guessing GHL's exact filter syntax.
 */
export async function searchContactsByTag(connection: GhlConnection, tag: string): Promise<GhlContact[]> {
  const needle = tag.trim().toLowerCase();
  const matches: GhlContact[] = [];
  let startAfter: string | undefined;
  let startAfterId: string | undefined;
  const PAGE_SIZE = 100;
  const MAX_PAGES = 20; // 2,000 contacts - raise if this location is bigger

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      locationId: connection.locationId,
      limit: String(PAGE_SIZE),
    });
    if (startAfter) params.set("startAfter", startAfter);
    if (startAfterId) params.set("startAfterId", startAfterId);

    const data = await ghlFetch<{ contacts: GhlContact[]; meta?: { startAfter?: string; startAfterId?: string } }>(
      connection,
      `/contacts/?${params.toString()}`,
    );
    const contacts = data.contacts ?? [];
    for (const contact of contacts) {
      const tags = (contact.tags ?? []).map((t) => t.trim().toLowerCase());
      if (tags.includes(needle)) matches.push(contact);
    }

    if (contacts.length < PAGE_SIZE) break; // last page
    const last = contacts[contacts.length - 1];
    if (!last) break;
    startAfterId = last.id;
    startAfter = data.meta?.startAfter ?? (last as unknown as { dateAdded?: string }).dateAdded;
    if (!startAfterId) break;
  }

  return matches;
}

/** PUT /opportunities/:id - moves a card to a different stage (drag-and-drop lands here). */
export async function updateOpportunityStage(
  connection: GhlConnection,
  opportunityId: string,
  pipelineStageId: string,
  pipelineId?: string,
): Promise<void> {
  await ghlFetch(connection, `/opportunities/${opportunityId}`, {
    method: "PUT",
    body: JSON.stringify({ pipelineStageId, ...(pipelineId ? { pipelineId } : {}) }),
  });
}

/** POST /contacts/ + POST /opportunities/ - a brand new lead created from the CSR board. */
export async function createContactAndOpportunity(
  connection: GhlConnection,
  input: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    zipCode?: string;
    pipelineId: string;
    stageId: string;
    tag: string;
  },
): Promise<{ contactId: string; opportunityId: string }> {
  const contact = await ghlFetch<{ contact: { id: string } }>(connection, "/contacts/", {
    method: "POST",
    body: JSON.stringify({
      locationId: connection.locationId,
      name: input.name,
      phone: input.phone || undefined,
      email: input.email || undefined,
      address1: input.address || undefined,
      postalCode: input.zipCode || undefined,
      tags: [input.tag],
    }),
  });

  const opportunity = await ghlFetch<{ opportunity: { id: string } }>(connection, "/opportunities/", {
    method: "POST",
    body: JSON.stringify({
      pipelineId: input.pipelineId,
      locationId: connection.locationId,
      pipelineStageId: input.stageId,
      name: input.name,
      contactId: contact.contact.id,
      status: "open",
    }),
  });

  return { contactId: contact.contact.id, opportunityId: opportunity.opportunity.id };
}

/** POST /contacts/:id/notes - outreach logged from the CSR dialog. */
export async function addContactNote(connection: GhlConnection, contactId: string, body: string): Promise<void> {
  await ghlFetch(connection, `/contacts/${contactId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

/* ==========================================================================
   Users - first-run setup imports the sub-account's users, and GHL
   auto-login re-checks one user on every sign-in.
   ========================================================================== */

export interface GhlUser {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  deleted?: boolean;
  /** e.g. { type: "account", role: "admin", locationIds: [...] }. "agency" users belong to the agency, not the sub-account. */
  roles?: { type?: string; role?: string; locationIds?: string[] };
}

export interface GhlLocation {
  id: string;
  name: string;
  companyId: string | null;
  /** The business email on the sub-account, used as an agency-owner hint. */
  email: string | null;
}

/** A connection built from credentials typed into the setup page, before anything is saved. */
export function connectionFromCredentials(token: string, locationId: string): GhlConnection {
  return { token, locationId, leadPipelineId: null, leadTag: "fb-lead" };
}

/** GET /locations/:id - proves the token can read this sub-account. */
export async function getLocation(connection: GhlConnection): Promise<GhlLocation> {
  const data = await ghlFetch<{
    location?: { id: string; name?: string; companyId?: string; email?: string };
  }>(connection, `/locations/${encodeURIComponent(connection.locationId)}`);
  if (!data.location?.id) throw new Error("GoHighLevel did not return that location.");
  return {
    id: data.location.id,
    name: data.location.name ?? data.location.id,
    companyId: data.location.companyId ?? null,
    email: data.location.email?.trim().toLowerCase() || null,
  };
}

/**
 * GET /companies/:id - the agency's own email, the strongest owner signal.
 * A sub-account PIT often lacks the companies scope; that is not an error
 * here, it just means the next signal is used.
 */
export async function getCompanyEmail(connection: GhlConnection, companyId: string): Promise<string | null> {
  try {
    const data = await ghlFetch<{ company?: { email?: string } }>(
      connection,
      `/companies/${encodeURIComponent(companyId)}`,
    );
    return data.company?.email?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * A user who can work in this sub-account: not deleted, and either an agency
 * user or a sub-account user, whose location list (when GHL sends one)
 * includes this location.
 */
export function isLocationUser(user: GhlUser, locationId: string): boolean {
  if (user.deleted) return false;
  const type = user.roles?.type;
  if (type !== "account" && type !== "agency") return false;
  const locations = user.roles?.locationIds ?? [];
  return locations.length === 0 || locations.includes(locationId);
}

/** GET /users/?locationId= - every user GHL lists for the location. */
export async function listLocationUsers(connection: GhlConnection): Promise<GhlUser[]> {
  const data = await ghlFetch<{ users?: GhlUser[] }>(
    connection,
    `/users/?locationId=${encodeURIComponent(connection.locationId)}`,
  );
  return data.users ?? [];
}

/** GET /users/:id - one user, or null when GHL does not know the id. */
export async function getGhlUser(connection: GhlConnection, userId: string): Promise<GhlUser | null> {
  try {
    const data = await ghlFetch<GhlUser & { user?: GhlUser }>(
      connection,
      `/users/${encodeURIComponent(userId)}`,
    );
    return data.user ?? (data.id ? data : null);
  } catch (error) {
    if (error instanceof Error && /GHL (400|404|422) /.test(error.message)) return null;
    throw error;
  }
}

/** "account:admin", "account:user" - what the user is in GHL, stored next to their app role. */
export function ghlRoleOf(user: GhlUser): string {
  return `${user.roles?.type ?? "unknown"}:${user.roles?.role ?? "unknown"}`;
}
