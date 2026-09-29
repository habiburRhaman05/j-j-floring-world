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
   The template ("JJ_Flooring_Estimate" by default) is built once in GHL. Each
   send writes this estimate's figures onto the contact's custom fields, and
   the template reads them back with merge tags such as
   {{contact.estimate___good___total}}.

   There is one field per (package, value): a Good/Better/Best section on
   the document is a self-contained block that reads only its own tier's
   fields, so an empty package renders as an empty section (or is hidden
   with a conditional block in the template) without leaking Better values
   into Good's card.

   The scope field carries an HTML <table> of the package's line items,
   built here from snapshotted prices. GHL Documents renders the HTML
   verbatim inside a LARGE_TEXT merge target, so the customer sees a proper
   table with columns, not a wall of text.

   Fields are created here on first use and never overwrite any field the
   location already carries.
   ========================================================================== */

export const ESTIMATE_TEMPLATE_NAME = process.env.GHL_ESTIMATE_TEMPLATE_NAME?.trim() || "JJ_Flooring_Estimate_Pdf";

const TIERS_ORDERED: Tier[] = ["Good", "Better", "Best"];

/** Shared across every package. */
type SharedKey = "number" | "customer_name" | "valid_until" | "notes";

/** Repeated for each of Good / Better / Best. */
type PerTierKey = "label" | "summary" | "scope" | "subtotal" | "discount" | "tax" | "total" | "deposit";

/** e.g. "good.total", "better.scope". */
export type EstimateFieldKey = SharedKey | `${Lowercase<Tier>}.${PerTierKey}`;

interface FieldSpec {
  key: EstimateFieldKey;
  name: string;
  type: "TEXT" | "LARGE_TEXT";
}

const PER_TIER_SPECS: { key: PerTierKey; label: string; type: "TEXT" | "LARGE_TEXT" }[] = [
  { key: "label", label: "Label", type: "TEXT" },
  { key: "summary", label: "Summary", type: "LARGE_TEXT" },
  { key: "scope", label: "Scope and Pricing", type: "LARGE_TEXT" },
  { key: "subtotal", label: "Subtotal", type: "TEXT" },
  { key: "discount", label: "Discount", type: "TEXT" },
  { key: "tax", label: "Sales Tax", type: "TEXT" },
  { key: "total", label: "Total", type: "TEXT" },
  { key: "deposit", label: "Deposit Due", type: "TEXT" },
];

/** All 4 shared + 3 tiers × 8 per-tier = 28 fields. */
export const ESTIMATE_FIELDS: readonly FieldSpec[] = [
  { key: "number", name: "Estimate - Number", type: "TEXT" },
  { key: "customer_name", name: "Estimate - Customer Name", type: "TEXT" },
  { key: "valid_until", name: "Estimate - Valid Until", type: "TEXT" },
  { key: "notes", name: "Estimate - Notes", type: "LARGE_TEXT" },
  ...TIERS_ORDERED.flatMap((tier) =>
    PER_TIER_SPECS.map(
      (spec): FieldSpec => ({
        key: `${tier.toLowerCase() as Lowercase<Tier>}.${spec.key}`,
        name: `Estimate - ${tier} - ${spec.label}`,
        type: spec.type,
      }),
    ),
  ),
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
  /** Merge tag, e.g. "{{contact.estimate___good___total}}" */
  mergeTag: string;
}

let cache: { at: number; locationId: string; fields: Map<EstimateFieldKey, EnsuredField> } | null = null;
const CACHE_MS = 10 * 60 * 1000;

const norm = (s: string) => s.trim().toLowerCase();

/** Finds each estimate field, creating any that does not exist yet.
 *  Never touches a field with a different name - only ADDS what is missing. */
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

/** Every merge tag the template can use, listed for the setup screen. */
export async function estimateMergeTags(
  connection: GhlConnection,
): Promise<{ name: string; mergeTag: string; type: "TEXT" | "LARGE_TEXT" }[]> {
  const fields = await ensureEstimateFields(connection);
  return ESTIMATE_FIELDS.map((spec) => ({
    name: spec.name,
    mergeTag: fields.get(spec.key)!.mergeTag,
    type: spec.type,
  }));
}

/* ----------------------------------------------------------------- values */

const dateLong = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function packageLabel(tier: Tier, meta: { label?: string | null }): string {
  return meta.label?.trim() || tier;
}

/** One package's line items as an HTML table. GHL Documents renders this
 *  verbatim inside a LARGE_TEXT merge target, so the customer sees columns,
 *  not a paragraph. Inline styles only (GHL strips class-based rules). */
function scopeHtml(tier: Tier, estimate: Estimate): string {
  const meta = estimate.tierMeta[tier];
  const totals = estimateTierTotals(estimate.tiers[tier], meta, estimate.taxRate);

  if (totals.rows.length === 0) return "";

  const rows = totals.rows
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e8ee;vertical-align:top;">
            <div style="font-weight:600;color:#05192E;">${esc(row.name)}</div>
            ${row.description ? `<div style="font-size:12px;color:#7A8698;margin-top:2px;">${esc(row.description)}</div>` : ""}
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e8ee;text-align:right;color:#46536B;white-space:nowrap;">
            ${qty(row.qty)} ${esc(row.unit)}
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e8ee;text-align:right;color:#46536B;white-space:nowrap;">
            ${money2(row.unitPrice)}
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e8ee;text-align:right;font-weight:600;color:#05192E;white-space:nowrap;">
            ${money2(row.linePrice)}
          </td>
        </tr>`,
    )
    .join("");

  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
  <thead>
    <tr style="background:#f6f7f9;">
      <th style="padding:8px 10px;text-align:left;font-size:11px;color:#7A8698;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #d5dbe4;">Item</th>
      <th style="padding:8px 10px;text-align:right;font-size:11px;color:#7A8698;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #d5dbe4;">Qty</th>
      <th style="padding:8px 10px;text-align:right;font-size:11px;color:#7A8698;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #d5dbe4;">Unit</th>
      <th style="padding:8px 10px;text-align:right;font-size:11px;color:#7A8698;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #d5dbe4;">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`.trim();
}

/** All the values for one Good/Better/Best block. Empty package yields empty
 *  strings for every field, so a template with a "hide if empty" condition
 *  can drop the whole section cleanly. */
function tierFieldValues(
  tier: Tier,
  estimate: Estimate,
): Record<PerTierKey, string> {
  const meta = estimate.tierMeta[tier];
  const totals = estimateTierTotals(estimate.tiers[tier], meta, estimate.taxRate);
  const isEmpty = totals.rows.length === 0;
  if (isEmpty) {
    return { label: "", summary: "", scope: "", subtotal: "", discount: "", tax: "", total: "", deposit: "" };
  }
  const deposit = Math.round(totals.totalPrice * (estimate.depositPercent / 100) * 100) / 100;
  return {
    label: packageLabel(tier, meta),
    summary: meta.summary?.trim() ?? "",
    scope: scopeHtml(tier, estimate),
    subtotal: money2(totals.subtotalPrice),
    discount: totals.discountAmount > 0 ? `-${money2(totals.discountAmount)}` : "",
    tax: estimate.taxRate > 0 ? `${money2(totals.taxAmount)} (${estimate.taxRate}%)` : "",
    total: money2(totals.totalPrice),
    deposit: `${money2(deposit)} (${estimate.depositPercent}%)`,
  };
}

/**
 * Field values for every non-empty package plus the shared header/footer
 * bits. Each package's fields are self-contained, so the GHL template shows
 * one card per tier without mixing values between them.
 */
export function estimateFieldValues(
  estimate: Estimate,
  validDays = 30,
): Record<EstimateFieldKey, string> {
  const out: Partial<Record<EstimateFieldKey, string>> = {
    number: estimate.number,
    customer_name: estimate.customer?.name ?? "",
    valid_until: dateLong(new Date(Date.now() + validDays * 24 * 60 * 60 * 1000)),
    notes: estimate.customerNotes?.trim() ?? "",
  };

  for (const tier of TIERS_ORDERED) {
    const values = tierFieldValues(tier, estimate);
    const prefix = tier.toLowerCase() as Lowercase<Tier>;
    for (const [k, v] of Object.entries(values)) {
      out[`${prefix}.${k as PerTierKey}`] = v;
    }
  }

  return out as Record<EstimateFieldKey, string>;
}

/** Writes an estimate onto the contact's fields.
 *  Only writes fields the app owns; never touches a location field that
 *  isn't in `ESTIMATE_FIELDS`. */
export async function writeEstimateFields(
  connection: GhlConnection,
  contactId: string,
  values: Record<EstimateFieldKey, string>,
): Promise<void> {
  const fields = await ensureEstimateFields(connection);
  await setContactCustomFields(
    connection,
    contactId,
    ESTIMATE_FIELDS.map((spec) => ({ id: fields.get(spec.key)!.id, value: values[spec.key] ?? "" })),
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

/** Finds the saved template to send. Read-only. */
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
