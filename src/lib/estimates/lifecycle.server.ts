import "server-only";
import { prisma } from "@/lib/prisma";
import {
  getContact,
  listDocuments,
  sendProposalTemplate,
  updateOpportunity,
  updateOpportunityStatus,
  type GhlConnection,
  type GhlDocument,
} from "@/lib/ghl/client";
import { findSalesPipeline, type Viewer } from "@/lib/ghl/sales-board";
import { tierToDb } from "@/lib/products/map";
import type { Tier } from "@/lib/types";
import {
  EstimateError,
  bestEffort,
  estimateInclude,
  getEstimateForViewer,
  loadForViewer,
  opportunityFor,
  tierTotal,
  toUiEstimate,
} from "./estimates.server";
import {
  emailBlockReason,
  estimateFieldValues,
  findEstimateTemplate,
  writeEstimateFields,
} from "./ghl-document.server";

/* ==========================================================================
   lifecycle.server.ts  -  Draft -> Waiting for approval -> Approved
   --------------------------------------------------------------------------
   Draft               created and saved in the app, nothing sent
   Waiting for approval the rep confirmed the send; GHL emailed the customer
                       the estimate document (status Sent, then Viewed)
   Approved            the customer signed the GHL document

   The customer signing IS the approval. There is deliberately no staff
   "approve" or in-app "sign" action, so an approval can only ever come from
   the customer's own signature in GoHighLevel.
   ========================================================================== */

/**
 * Sends ALL non-empty packages to the customer for signature: mirrors every
 * package's figures onto the contact's per-tier "Estimate - Good - ...",
 * "Estimate - Better - ..." and "Estimate - Best - ..." fields, then has
 * GHL email the saved template to the contact. The customer picks a
 * package with the template's radio field, signs, and that IS the approval;
 * readSelectedTier() in the sync loop records which one they chose.
 *
 * A failed send is a failed request - the estimate stays a Draft rather
 * than claiming it went out.
 */
export async function sendEstimate(connection: GhlConnection, viewer: Viewer, estimateId: string) {
  const row = await loadForViewer(viewer, estimateId);
  if (row.status === "SIGNED") throw new EstimateError("This estimate is already approved.", 409, "estimate_signed");

  const TIER_ORDER: Tier[] = ["Good", "Better", "Best"];
  const activeTiers = TIER_ORDER.filter((t) => {
    const tierRow = row.tiers.find((rt) => rt.level === tierToDb(t)!);
    return tierRow && tierRow.lineItems.length > 0;
  });

  if (activeTiers.length === 0) {
    throw new EstimateError("No packages have lines. Add at least one line before sending.", 422, "tier_empty");
  }
  if (!row.lead.ghlContactId) {
    throw new EstimateError("This customer isn't linked to a GoHighLevel contact.", 422, "customer_unlinked");
  }
  if (!viewer.ghlUserId) {
    throw new EstimateError(
      "Your account isn't linked to a GoHighLevel user, so GoHighLevel can't send on your behalf.",
      422,
      "sender_unlinked",
    );
  }

  const contact = await getContact(connection, row.lead.ghlContactId);
  if (!contact) throw new EstimateError("That customer no longer exists in GoHighLevel.", 404, "customer_missing");
  const blocked = emailBlockReason(contact);
  if (blocked) throw new EstimateError(blocked, 422, "email_blocked");

  const template = await findEstimateTemplate(connection);
  await writeEstimateFields(connection, contact.id, estimateFieldValues(toUiEstimate(row, true)));

  // Primary tier for opportunity value pre-sign: Better when it is one of
  // the packages sent, otherwise the first non-empty one. The final accepted
  // tier is set later, from the customer's radio pick, in syncEstimateDocuments.
  const primaryTier = activeTiers.includes("Better") ? "Better" : activeTiers[0];
  const primaryLevel = tierToDb(primaryTier)!;
  const primaryTierRow = row.tiers.find((t) => t.level === primaryLevel)!;

  let sent;
  try {
    sent = await sendProposalTemplate(connection, {
      templateId: template.id,
      contactId: contact.id,
      userId: viewer.ghlUserId,
      send: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    console.error("[estimates] GHL template send failed:", error);
    if (/GHL (401|403) /.test(detail)) {
      throw new EstimateError(
        "The GoHighLevel token can't send documents. Add the documents_contracts_template/sendLink.write scope to the Private Integration token.",
        502,
        "ghl_scope_send",
      );
    }
    throw new EstimateError(
      "GoHighLevel refused to send the document. Nothing was sent to the customer.",
      502,
      "ghl_send_failed",
    );
  }
  if (!sent.documentId) {
    throw new EstimateError(
      "GoHighLevel did not confirm the document was created. Check it in GoHighLevel before resending.",
      502,
      "ghl_send_unconfirmed",
    );
  }

  await prisma.$transaction([
    prisma.estimate.update({
      where: { id: row.id },
      data: {
        status: "SENT",
        sentTier: primaryLevel,
        ghlDocumentId: sent.documentId,
        documentStatus: "SENT",
        documentUrl: sent.url,
        documentSentAt: new Date(),
        documentViewedAt: null,
      },
    }),
    prisma.lead.update({ where: { id: row.leadId }, data: { stage: "ESTIMATE_SENT" } }),
    prisma.estimateEvent.create({
      data: {
        estimateId: row.id,
        type: "sent",
        actorId: viewer.userId,
        payload: { tiers: activeTiers, documentId: sent.documentId },
      },
    }),
  ]);

  const warning = await bestEffort("opportunity value and stage", async () => {
    const opp = await opportunityFor(connection, row);
    if (!opp) return;
    const pipeline = await findSalesPipeline(connection);
    const sentStage = pipeline.stages.find((s) => s.name.trim().toLowerCase() === "estimate sent");
    await updateOpportunity(connection, opp.id, {
      pipelineId: pipeline.id,
      monetaryValue: Number(primaryTierRow.totalPrice),
      ...(sentStage && opp.status === "open" ? { pipelineStageId: sentStage.id } : {}),
    });
  });

  return { estimate: await getEstimateForViewer(viewer, row.id), warning };
}

/* ------------------------------------------------------ signature tracking */

const SIGNED_STATUSES = new Set(["completed", "accepted", "signed"]);

interface DocumentState {
  signed: boolean;
  viewed: boolean;
  signerName: string | null;
  signerEmail: string | null;
  /** The tier the customer picked with the "Select your package" radio on the
   *  signed document, when the template carries one. Null when the template
   *  has no radio - the fallback (sentTier || Better) takes over. */
  selectedTier: Tier | null;
}

const TIER_ALIASES: { key: Tier; needle: RegExp }[] = [
  { key: "Best", needle: /best|premium/i },
  { key: "Better", needle: /better|preferred|recommended|middle/i },
  { key: "Good", needle: /good|basic|standard/i },
];

/** Read the customer's radio-button pick out of the signed document. GHL
 *  returns filled form fields in a few shapes (fields[], formFields[],
 *  customFields[], recipients[].fields[]); we walk them all and match on
 *  either a field labelled "select your package" or a value that IS a tier
 *  name. Never guesses when nothing matches - the caller falls back. */
function readSelectedTier(doc: GhlDocument): Tier | null {
  const raw = doc.raw as Record<string, unknown>;

  const candidateBuckets: Array<{ label?: string; value?: unknown }[]> = [];
  for (const key of ["fields", "formFields", "customFields", "inputs"]) {
    const v = raw[key];
    if (Array.isArray(v)) candidateBuckets.push(v as { label?: string; value?: unknown }[]);
  }
  const recipients =
    (raw.recipients as { fields?: { label?: string; value?: unknown }[] }[] | undefined) ?? [];
  for (const rec of recipients) {
    if (Array.isArray(rec.fields)) candidateBuckets.push(rec.fields);
  }

  const looksLikePackagePick = (label?: string) =>
    !!label && /select.*package|choose.*package|package.*choice|which.*package/i.test(label);

  // First pass: a field explicitly labelled as the package picker.
  for (const bucket of candidateBuckets) {
    for (const f of bucket) {
      if (looksLikePackagePick(f?.label) && typeof f?.value === "string") {
        const match = TIER_ALIASES.find((t) => t.needle.test(f.value as string));
        if (match) return match.key;
      }
    }
  }

  // Second pass: any field whose value is (or contains) a tier name.
  for (const bucket of candidateBuckets) {
    for (const f of bucket) {
      if (typeof f?.value === "string") {
        const match = TIER_ALIASES.find((t) => t.needle.test(f.value as string));
        if (match) return match.key;
      }
    }
  }

  return null;
}

function documentState(doc: GhlDocument): DocumentState {
  const recipients =
    (doc.raw.recipients as
      | { role?: string; hasCompleted?: boolean; contactName?: string; email?: string }[]
      | undefined) ?? [];
  const signers = recipients.filter((r) => !r.role || r.role === "signer");
  const allCompleted = signers.length > 0 && signers.every((r) => r.hasCompleted);
  const signer = signers.find((r) => r.hasCompleted) ?? signers[0];
  const signed = SIGNED_STATUSES.has(doc.status) || allCompleted;
  return {
    signed,
    viewed: doc.status === "viewed",
    signerName: signer?.contactName ?? null,
    signerEmail: signer?.email ?? null,
    selectedTier: signed ? readSelectedTier(doc) : null,
  };
}

/**
 * Reads the estimates waiting for approval against GHL and records what has
 * happened to their documents. Runs on page load, so it costs nothing (no
 * GHL call at all) when nothing is waiting.
 */
export async function syncEstimateDocuments(connection: GhlConnection, viewer: Viewer): Promise<number> {
  const waiting = await prisma.estimate.findMany({
    where: {
      status: { in: ["SENT", "VIEWED"] },
      ghlDocumentId: { not: null },
      ...(viewer.isAdmin ? {} : { repId: viewer.userId }),
    },
    include: estimateInclude,
  });
  if (waiting.length === 0) return 0;

  const documents = new Map((await listDocuments(connection)).map((d) => [d.id, d] as const));
  let changed = 0;

  for (const row of waiting) {
    const doc = documents.get(row.ghlDocumentId!);
    if (!doc) continue;
    const state = documentState(doc);

    if (state.signed) {
      // Prefer the customer's actual radio-button pick on the signed doc;
      // fall back to whatever tier we sent as the primary one, then Better.
      const level =
        (state.selectedTier ? tierToDb(state.selectedTier) : null) ?? row.sentTier ?? "BETTER";
      // Whoever claims the row first records the approval; a parallel page load skips it.
      const claimed = await prisma.estimate.updateMany({
        where: { id: row.id, status: { in: ["SENT", "VIEWED"] } },
        data: {
          status: "SIGNED",
          documentStatus: "SIGNED",
          signedAt: new Date(),
          signedByName: state.signerName ?? `${row.lead.firstName} ${row.lead.lastName}`.trim(),
          signedByEmail: state.signerEmail,
          acceptedTier: level,
        },
      });
      if (claimed.count === 0) continue;
      changed += 1;
      await prisma.$transaction([
        prisma.lead.update({ where: { id: row.leadId }, data: { stage: "WON" } }),
        prisma.estimateEvent.create({
          data: {
            estimateId: row.id,
            type: "signed",
            payload: { tier: level, documentId: doc.id, via: "ghl_document" },
          },
        }),
      ]);
      const total = tierTotal(row, level);
      await bestEffort("opportunity won", async () => {
        const opp = await opportunityFor(connection, row);
        if (!opp) return;
        const pipeline = await findSalesPipeline(connection);
        const approvedStage = pipeline.stages.find((s) => s.name.trim().toLowerCase() === "estimate approved");
        await updateOpportunity(connection, opp.id, {
          pipelineId: pipeline.id,
          monetaryValue: total,
          ...(approvedStage ? { pipelineStageId: approvedStage.id } : {}),
        });
        await updateOpportunityStatus(connection, opp.id, "won");
      });
    } else if (state.viewed && row.status === "SENT") {
      changed += 1;
      await prisma.$transaction([
        prisma.estimate.update({
          where: { id: row.id },
          data: { status: "VIEWED", documentStatus: "VIEWED", documentViewedAt: new Date() },
        }),
        prisma.estimateEvent.create({ data: { estimateId: row.id, type: "viewed", payload: { documentId: doc.id } } }),
      ]);
    }
  }
  return changed;
}
