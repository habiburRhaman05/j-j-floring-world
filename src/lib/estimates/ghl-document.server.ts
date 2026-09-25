import "server-only";
import {
  createContactCustomField,
  listContactCustomFields,
  listProposalTemplates,
  setContactCustomFields,
  type GhlConnection,
} from "@/lib/ghl/client";
import { estimateTierTotals } from "@/lib/data/pricing";
import { money2, qty } from "@/lib/format";
import type { Estimate, Tier } from "@/lib/types";

/* ==========================================================================
   ghl-document.server.ts  -  what the GHL estimate document is filled from
   --------------------------------------------------------------------------
   The template ("estimate-template" by default) is built once in GHL. Each
   send writes this estimate's figures into the contact's custom fields
   named "Estimate - ...", and the template reads them back with merge tags
   such as {{contact.estimate___total}}. The fields are created here on
   first use, and never overwrite any existing field of the location.
   ========================================================================== */

export const ESTIMATE_TEMPLATE_NAME = process.env.GHL_ESTIMATE_TEMPLATE_NAME?.trim() || "estimate-template";

export type EstimateFieldKey =
  | "number"
  | "package"
  | "summary"
  | "scope"
  | "subtotal"
  | "discount"
  | "tax"
  | "total"
  | "deposit"
  | "balance"
  | "valid_until"
  | "notes";

export const ESTIMATE_FIELDS: readonly { key: EstimateFieldKey; name: string; type: "TEXT" | "LARGE_TEXT" }[] = [
  { key: "number", name: "Estimate - Number", type: "TEXT" },
  { key: "package", name: "Estimate - Package", type: "TEXT" },
  { key: "summary", name: "Estimate - Package Summary", type: "LARGE_TEXT" },
  { key: "scope", name: "Estimate - Scope and Pricing", type: "LARGE_TEXT" },
  { key: "subtotal", name: "Estimate - Subtotal", type: "TEXT" },
  { key: "discount", name: "Estimate - Discount", type: "TEXT" },
  { key: "tax", name: "Estimate - Sales Tax", type: "TEXT" },
  { key: "total", name: "Estimate - Total", type: "TEXT" },
  { key: "deposit", name: "Estimate - Deposit Due", type: "TEXT" },
  { key: "balance", name: "Estimate - Balance Due", type: "TEXT" },
  { key: "valid_until", name: "Estimate - Valid Until", type: "TEXT" },
  { key: "notes", name: "Estimate - Notes", type: "LARGE_TEXT" },
];

export class EstimateDocumentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "EstimateDocumentError";
  }
}

export interface EnsuredField {
  id: string;
  /** Merge tag, e.g. "{{contact.estimate___total}}" */
  mergeTag: string;
}

let cache: { at: number; locationId: string; fields: Map<EstimateFieldKey, EnsuredField> } | null = null;
const CACHE_MS = 10 * 60 * 1000;

const norm = (s: string) => s.trim().toLowerCase();

/** Finds each "Estimate - ..." field, creating any that does not exist yet. */
export async function ensureEstimateFields(connection: GhlConnection): Promise<Map<EstimateFieldKey, EnsuredField>> {
  if (cache && cache.locationId === connection.locationId && Date.now() - cache.at < CACHE_MS) return cache.fields;

  const existing = await listContactCustomFields(connection);
  const byName = new Map(existing.map((f) => [norm(f.name), f] as const));
  const out = new Map<EstimateFieldKey, EnsuredField>();

  for (const spec of ESTIMATE_FIELDS) {
    let field = byName.get(norm(spec.name));
    if (!field) {
      try {
        field = await createContactCustomField(connection, { name: spec.name, dataType: spec.type });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "";
        if (/GHL (401|403) /.test(detail)) {
          throw new EstimateDocumentError(
            "The GoHighLevel token can't create custom fields. Add the locations/customFields.write scope to the Private Integration token.",
            502,
            "ghl_scope_custom_fields",
          );
        }
        throw error;
      }
    }
    out.set(spec.key, { id: field.id, mergeTag: `{{${field.fieldKey}}}` });
  }

  cache = { at: Date.now(), locationId: connection.locationId, fields: out };
  return out;
}

/** The merge tag to type into the template for each field, for the setup instructions. */
export async function estimateMergeTags(connection: GhlConnection): Promise<{ name: string; mergeTag: string }[]> {
  const fields = await ensureEstimateFields(connection);
  return ESTIMATE_FIELDS.map((spec) => ({ name: spec.name, mergeTag: fields.get(spec.key)!.mergeTag }));
}

/* ----------------------------------------------------------------- values */

const dateLong = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

/** The text each field carries for one package of an estimate. */
export function estimateFieldValues(
  estimate: Estimate,
  tier: Tier,
  validDays = 30,
): Record<EstimateFieldKey, string> {
  const meta = estimate.tierMeta[tier];
  const totals = estimateTierTotals(estimate.tiers[tier], meta, estimate.taxRate);
  const deposit = Math.round(totals.totalPrice * (estimate.depositPercent / 100) * 100) / 100;
  const packageName = meta.label?.trim() ? `${meta.label.trim()} (${tier})` : tier;

  const scope = totals.rows
    .map((row, i) => {
      const line = `${i + 1}. ${row.name} - ${qty(row.qty)} ${row.unit} x ${money2(row.unitPrice)} = ${money2(row.linePrice)}`;
      return row.description ? `${line}\n    ${row.description}` : line;
    })
    .join("\n");

  return {
    number: estimate.number,
    package: packageName,
    summary: meta.summary?.trim() ?? "",
    scope,
    subtotal: money2(totals.subtotalPrice),
    discount: totals.discountAmount > 0 ? `-${money2(totals.discountAmount)}` : "None",
    tax: estimate.taxRate > 0 ? `${money2(totals.taxAmount)} (${estimate.taxRate}%)` : "None",
    total: money2(totals.totalPrice),
    deposit: `${money2(deposit)} (${estimate.depositPercent}%)`,
    balance: money2(Math.round((totals.totalPrice - deposit) * 100) / 100),
    valid_until: dateLong(new Date(Date.now() + validDays * 24 * 60 * 60 * 1000)),
    notes: estimate.customerNotes?.trim() ?? "",
  };
}

/** Writes an estimate package onto the contact's "Estimate - ..." fields. */
export async function writeEstimateFields(
  connection: GhlConnection,
  contactId: string,
  values: Record<EstimateFieldKey, string>,
): Promise<void> {
  const fields = await ensureEstimateFields(connection);
  await setContactCustomFields(
    connection,
    contactId,
    ESTIMATE_FIELDS.map((spec) => ({ id: fields.get(spec.key)!.id, value: values[spec.key] })),
  );
}

/**
 * Whether GHL lets us email this contact. The per-channel Email setting is
 * authoritative when GHL sends it; otherwise the all-channel flag decides.
 * Never email someone who opted out.
 */
export function emailBlockReason(contact: {
  email?: string;
  dnd?: boolean;
  dndSettings?: Record<string, { status?: string } | undefined>;
}): string | null {
  if (!contact.email?.trim()) return "This customer has no email address in GoHighLevel.";
  const email = contact.dndSettings?.Email?.status?.toLowerCase();
  const optedOut = email ? email === "active" || email === "permanent" : contact.dnd === true;
  return optedOut ? "This customer has opted out of email in GoHighLevel (Do Not Disturb), so it can't be sent." : null;
}

/** Finds the saved template to send. */
export async function findEstimateTemplate(connection: GhlConnection): Promise<{ id: string; name: string }> {
  let templates;
  try {
    templates = await listProposalTemplates(connection);
  } catch (error) {
    if (error instanceof Error && /GHL (401|403) /.test(error.message)) {
      throw new EstimateDocumentError(
        "The GoHighLevel token can't read Documents & Contracts templates. Add the documents_contracts_template/list.readonly scope.",
        502,
        "ghl_scope_templates",
      );
    }
    throw error;
  }
  const wanted = norm(ESTIMATE_TEMPLATE_NAME);
  const template = templates.find((t) => norm(t.name) === wanted && (!t.type || t.type === "proposal"));
  if (!template) {
    throw new EstimateDocumentError(
      `GoHighLevel has no Documents & Contracts template named "${ESTIMATE_TEMPLATE_NAME}". Create it, or set GHL_ESTIMATE_TEMPLATE_NAME.`,
      404,
      "ghl_template_missing",
    );
  }
  return template;
}
