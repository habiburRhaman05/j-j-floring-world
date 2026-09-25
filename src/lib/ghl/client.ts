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
  /** GHL user id of the owner ("Owner" on the card). Often null - see sales-board.ts. */
  assignedTo?: string | null;
  /** GHL user ids following the opportunity. */
  followers?: string[];
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** When the status last changed - for a won or lost deal, when it closed. */
  lastStatusChangeAt?: string | null;
  lastStageChangeAt?: string | null;
  contact?: { id?: string; name?: string; email?: string; phone?: string; tags?: string[] };
}

/** GET /opportunities/:id - one opportunity, for checking who owns it before a change. */
export async function getOpportunity(connection: GhlConnection, opportunityId: string): Promise<GhlOpportunity | null> {
  try {
    const data = await ghlFetch<{ opportunity?: GhlOpportunity }>(
      connection,
      `/opportunities/${encodeURIComponent(opportunityId)}`,
    );
    return data.opportunity ?? null;
  } catch (error) {
    if (error instanceof Error && /GHL (400|404|422) /.test(error.message)) return null;
    throw error;
  }
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
  /** All-channel do-not-disturb, and the per-channel state ({ Email: { status: "active" | "inactive" | "permanent" } }). */
  dnd?: boolean;
  dndSettings?: Record<string, { status?: string; message?: string; code?: string } | undefined>;
  /** GHL user id the contact is assigned to. */
  assignedTo?: string | null;
}

/**
 * Every contact in the location, paged 100 at a time (capped at 2,000 -
 * raise MAX_PAGES if this location grows past that).
 *
 * GHL's POST /contacts/search "filters" DSL is thinly documented and did not
 * match tags reliably against a live account (a contact visibly tagged
 * "fb-lead" in the GHL UI came back as zero results), so callers filter the
 * full list themselves - slower, but no guessing at GHL's filter syntax.
 */
export async function listAllContacts(connection: GhlConnection): Promise<GhlContact[]> {
  const all: GhlContact[] = [];
  let startAfter: string | undefined;
  let startAfterId: string | undefined;
  const PAGE_SIZE = 100;
  const MAX_PAGES = 20;

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
    all.push(...contacts);

    if (contacts.length < PAGE_SIZE) break; // last page
    const last = contacts[contacts.length - 1];
    if (!last) break;
    startAfterId = last.id;
    startAfter = data.meta?.startAfter ?? (last as unknown as { dateAdded?: string }).dateAdded;
    if (!startAfterId) break;
  }

  return all;
}

/** GET /contacts/:id - one contact, or null when GHL does not know it. */
export async function getContact(connection: GhlConnection, contactId: string): Promise<GhlContact | null> {
  try {
    const data = await ghlFetch<{ contact?: GhlContact }>(connection, `/contacts/${encodeURIComponent(contactId)}`);
    return data.contact ?? null;
  } catch (error) {
    if (error instanceof Error && /GHL (400|404|422) /.test(error.message)) return null;
    throw error;
  }
}

/** Every contact carrying a given tag (e.g. "fb-lead"), matched case-insensitively. */
export async function searchContactsByTag(connection: GhlConnection, tag: string): Promise<GhlContact[]> {
  const needle = tag.trim().toLowerCase();
  const contacts = await listAllContacts(connection);
  return contacts.filter((c) => (c.tags ?? []).some((t) => t.trim().toLowerCase() === needle));
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

/** PUT /opportunities/:id - value and/or stage. */
export async function updateOpportunity(
  connection: GhlConnection,
  opportunityId: string,
  fields: { pipelineId: string; pipelineStageId?: string; monetaryValue?: number },
): Promise<void> {
  await ghlFetch(connection, `/opportunities/${encodeURIComponent(opportunityId)}`, {
    method: "PUT",
    body: JSON.stringify(fields),
  });
}

/** PUT /opportunities/:id/status - open, won, lost or abandoned. */
export async function updateOpportunityStatus(
  connection: GhlConnection,
  opportunityId: string,
  status: "open" | "won" | "lost" | "abandoned",
): Promise<void> {
  await ghlFetch(connection, `/opportunities/${encodeURIComponent(opportunityId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
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

/* ==========================================================================
   Estimate documents - GHL Documents & Contracts (proposal templates).
   The estimate's details are written to the contact's custom fields, then a
   saved template is sent to that contact; the template shows them through
   merge tags such as {{contact.estimate___total}}.
   ========================================================================== */

export interface GhlCustomField {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
}

/** GET /locations/:id/customFields - the contact fields of the location. */
export async function listContactCustomFields(connection: GhlConnection): Promise<GhlCustomField[]> {
  const data = await ghlFetch<{ customFields?: GhlCustomField[] }>(
    connection,
    `/locations/${encodeURIComponent(connection.locationId)}/customFields?model=contact`,
  );
  return data.customFields ?? [];
}

/** POST /locations/:id/customFields - adds one contact field. */
export async function createContactCustomField(
  connection: GhlConnection,
  field: { name: string; dataType: "TEXT" | "LARGE_TEXT" },
): Promise<GhlCustomField> {
  const data = await ghlFetch<{ customField?: GhlCustomField }>(
    connection,
    `/locations/${encodeURIComponent(connection.locationId)}/customFields`,
    { method: "POST", body: JSON.stringify({ ...field, model: "contact" }) },
  );
  if (!data.customField) throw new Error(`GoHighLevel did not create the "${field.name}" field.`);
  return data.customField;
}

/** PUT /contacts/:id - sets custom field values by field id. */
export async function setContactCustomFields(
  connection: GhlConnection,
  contactId: string,
  values: { id: string; value: string | number }[],
): Promise<void> {
  await ghlFetch(connection, `/contacts/${encodeURIComponent(contactId)}`, {
    method: "PUT",
    body: JSON.stringify({ customFields: values.map((v) => ({ id: v.id, field_value: v.value })) }),
  });
}

export interface GhlProposalTemplate {
  id: string;
  name: string;
  type?: string;
}

/** GET /proposals/templates - the saved Documents & Contracts templates. */
export async function listProposalTemplates(connection: GhlConnection): Promise<GhlProposalTemplate[]> {
  // GHL rejects a page bigger than 20 (422), so walk the pages.
  const PAGE = 20;
  const all: GhlProposalTemplate[] = [];
  for (let skip = 0; skip < 400; skip += PAGE) {
    const data = await ghlFetch<{ data?: { _id?: string; id?: string; name: string; type?: string; deleted?: boolean }[] }>(
      connection,
      `/proposals/templates?locationId=${encodeURIComponent(connection.locationId)}&limit=${PAGE}&skip=${skip}`,
    );
    const page = data.data ?? [];
    all.push(...page.filter((t) => !t.deleted).map((t) => ({ id: (t.id ?? t._id)!, name: t.name, type: t.type })));
    if (page.length < PAGE) break;
  }
  return all;
}

export interface GhlSentDocument {
  documentId: string | null;
  url: string | null;
  raw: unknown;
}

/**
 * POST /proposals/templates/send - creates a document from a template for a
 * contact. With `send: false` the document is created but not delivered.
 */
export async function sendProposalTemplate(
  connection: GhlConnection,
  input: { templateId: string; contactId: string; userId: string; send: boolean; opportunityId?: string },
): Promise<GhlSentDocument> {
  const data = await ghlFetch<{
    success?: boolean;
    documentId?: string;
    document?: { _id?: string; id?: string };
    links?: { documentId?: string; url?: string; recipientEmail?: string }[];
    [key: string]: unknown;
  }>(connection, "/proposals/templates/send", {
    method: "POST",
    body: JSON.stringify({
      locationId: connection.locationId,
      templateId: input.templateId,
      contactId: input.contactId,
      userId: input.userId,
      sendDocument: input.send,
      ...(input.opportunityId ? { opportunityId: input.opportunityId } : {}),
    }),
  });
  const link = data.links?.[0];
  return {
    documentId: data.document?._id ?? data.document?.id ?? data.documentId ?? link?.documentId ?? null,
    url: link?.url ?? null,
    raw: data,
  };
}

export interface GhlDocument {
  id: string;
  name: string;
  status: string;
  raw: Record<string, unknown>;
}

/** GET /proposals/document - documents in the location, newest first. */
export async function listDocuments(connection: GhlConnection, maxPages = 5): Promise<GhlDocument[]> {
  // GHL rejects a page bigger than 20 (422), so walk the pages.
  const PAGE = 20;
  const out: GhlDocument[] = [];
  for (let page = 0; page < maxPages; page++) {
    const data = await ghlFetch<{ documents?: Record<string, unknown>[] }>(
      connection,
      `/proposals/document?locationId=${encodeURIComponent(connection.locationId)}&limit=${PAGE}&skip=${page * PAGE}`,
    );
    const docs = data.documents ?? [];
    out.push(
      ...docs.map((d) => ({
        id: String(d._id ?? d.id),
        name: String(d.name ?? ""),
        status: String(d.status ?? d.documentStatus ?? "").toLowerCase(),
        raw: d,
      })),
    );
    if (docs.length < PAGE) break;
  }
  return out;
}

/* ==========================================================================
   Products - GHL Payments > Products is the estimate builder's price book.
   ========================================================================== */

export interface GhlProduct {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  productType?: string;
  status?: string;
}

export interface GhlPrice {
  _id: string;
  name: string;
  type?: string;
  currency?: string;
  amount: number;
  compareAtPrice?: number;
  deleted?: boolean;
}

/** GET /products/ - every product, walked 20 at a time. */
export async function listProducts(connection: GhlConnection): Promise<GhlProduct[]> {
  const PAGE = 20;
  const all: GhlProduct[] = [];
  for (let offset = 0; offset < 2000; offset += PAGE) {
    const data = await ghlFetch<{ products?: GhlProduct[] }>(
      connection,
      `/products/?locationId=${encodeURIComponent(connection.locationId)}&limit=${PAGE}&offset=${offset}`,
    );
    const page = data.products ?? [];
    all.push(...page);
    if (page.length < PAGE) break;
  }
  return all;
}

/** GET /products/:id/price - the prices of one product. */
export async function listProductPrices(connection: GhlConnection, productId: string): Promise<GhlPrice[]> {
  const data = await ghlFetch<{ prices?: GhlPrice[] }>(
    connection,
    `/products/${encodeURIComponent(productId)}/price?locationId=${encodeURIComponent(connection.locationId)}&limit=20&offset=0`,
  );
  return data.prices ?? [];
}
