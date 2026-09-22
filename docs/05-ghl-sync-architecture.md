# 05 · GoHighLevel Sync Architecture

Implements decisions **D2** (field-level ownership), **D3** (GHL invoices and
payments) and **D4** (GHL documents and e-signature).

---

## 1 · Principles

**P1 · Every synchronised field has exactly one owner.**
The non-owner may read and display it; it may never write it. Most conflicts
become structurally impossible rather than being resolved after they happen.

**P2 · The local database is always readable.**
The UI never calls the GHL API during a page render. Every screen reads local
tables. If GHL is down, the application is fully usable and only the sync
indicator changes.

**P3 · Writes to GHL go through the outbox, never inline.**
A user action commits a local row and a `SyncOutbox` row in one transaction.
The worker delivers it. A user never waits on a GHL round trip, and a crash
between the local write and the remote call cannot lose the change.

**P4 · Everything is idempotent.**
Outbound operations carry an idempotency key. Inbound webhooks deduplicate on
GHL's event ID. GHL retries; replaying a day of webhooks must change nothing.

**P5 · Echoes are suppressed.**
Pushing a change causes GHL to emit a webhook describing that same change. If
that echo is applied naively it either loops or overwrites a newer local edit.
Suppression is mandatory, not an optimisation. Mechanism in §6.

**P6 · Cost never leaves.**
No cost, margin, commission or supplier figure is ever transmitted to GHL, in
any payload, including invoice line items. GHL receives customer-facing
prices only.

---

## 2 · Field ownership map

This table is the contract. It is seeded into `SyncFieldPolicy` and the sync
layer reads it at runtime; it is not a document that code is trusted to
remember.

### Contact / Lead

| Field | Owner | Direction | Note |
|---|---|---|---|
| `firstName`, `lastName` | **GHL** | PULL | Marketing and conversations key off the GHL contact |
| `email`, `phone` | **GHL** | PULL | |
| `address*`, `city`, `state`, `postalCode` | **GHL** | PULL | Corrections are made in GHL |
| `ghlTags` | **GHL** | PULL | Read-only mirror, used for filtering |
| `source`, `sourceDetail` | **GHL** | PULL | Attribution belongs to the marketing system |
| `stage` | **APP** | PUSH | Our sales pipeline is authoritative; mapped to a GHL stage via `GhlPipelineMapping` |
| `assignedRepId` | **APP** | PUSH | Decision D5 makes assignment ours. Pushed to the GHL opportunity owner. |
| `lostReason`, `lostNote` | **APP** | PUSH | Pushed as a GHL custom field |
| `estimatedValue` | **APP** | PUSH | Opportunity monetary value |
| `scopeSummary` | **APP** | NONE | Internal |
| `slaStartedAt`, `slaBreachedAt` | **APP** | NONE | Internal |

**Creation is a special case.** A lead created by a CSR in our app is created
in GHL **first**. We call the GHL contact-create endpoint synchronously,
store the returned `ghlContactId`, and only then commit our row. If GHL is
unreachable, the lead is created locally with `ghlContactId = null` and an
outbox row backfills the ID when GHL returns. A lead with a null
`ghlContactId` is flagged in the CSR UI as "not yet in CRM".

### Opportunity

| Field | Owner | Direction |
|---|---|---|
| `ghlPipelineId`, `ghlStageId` | **APP** | PUSH (mapped from our `LeadStage`) |
| Opportunity monetary value | **APP** | PUSH |
| Opportunity owner | **APP** | PUSH |
| Opportunity status (open/won/lost) | **APP** | PUSH |

### Appointment

| Field | Owner | Direction | Note |
|---|---|---|---|
| `startAt`, `endAt`, `ghlCalendarId` | **GHL** | BIDIRECTIONAL | GHL owns the calendar and availability. We may request a booking; GHL's response is the truth. |
| `status` | **GHL** | PULL | Confirmed, showed, no-show all originate in GHL |
| `ownerId` | **GHL** | PULL | Derived from the GHL calendar owner |
| `type` (MEASURE / CONSULTATION) | **APP** | NONE | Our classification, GHL has no field for it |
| `leadId`, `jobId` links | **APP** | NONE | Internal |
| `selfBooked` | **GHL** | PULL | True when the appointment arrived without us creating it |

**Booking flow.** CSR books → we call GHL's appointment-create endpoint →
GHL returns the appointment → we store the mirror. We never write a local
appointment and assume GHL agrees; double-booking is decided by GHL's
availability engine, not ours.

### Estimate document (decision D4)

| Field | Owner | Direction |
|---|---|---|
| Estimate content, tiers, line items, prices | **APP** | PUSH (at document generation only) |
| `ghlDocumentId` | **GHL** | PULL (returned on creation) |
| `documentStatus`, `documentSentAt`, `documentViewedAt` | **GHL** | PULL |
| `signedAt`, `signedByName`, `signedByEmail` | **GHL** | PULL |
| Signature image, signed PDF, legal audit trail | **GHL** | Never stored here |
| `acceptedTier` | **APP** | derived from the signed document |
| Line item `unitCost` | **APP** | **NEVER TRANSMITTED** |

### Invoice (decision D3)

| Field | Owner | Direction |
|---|---|---|
| `ghlInvoiceId`, `ghlInvoiceUrl` | **GHL** | PULL |
| Line items and prices | **APP** | PUSH (at creation only) |
| `status`, `amountPaid`, `amountDue`, `paidAt` | **GHL** | PULL |
| `snapshotCost` | **APP** | **NEVER TRANSMITTED** |
| `depositPercent`, `depositAmount` | **APP** | PUSH (as invoice terms) |

### Payment (decision D3)

| Field | Owner | Direction |
|---|---|---|
| Everything | **GHL** | PULL |
| Offline payments recorded by staff | **APP** | PUSH once, then GHL owns the resulting record |

### Never synchronised

Products, costs, margin, commission rules, the commission ledger, payouts,
jobs, job stages, photos, issues, material orders, internal notes, users,
roles, permissions, audit logs. These have no GHL counterpart and must not
acquire one.

---

## 3 · Outbound: the transactional outbox

```
User action
   │
   ├─ BEGIN TRANSACTION
   │    UPDATE leads SET stage = 'QUALIFIED' ...
   │    INSERT INTO sync_outbox (entity, localId, operation, payload,
   │                             idempotencyKey, partitionKey)
   │    INSERT INTO audit_logs ...
   │  COMMIT
   │
   └─ return 200 immediately. The user is not waiting on GHL.

Worker loop (every 2 seconds)
   │
   ├─ SELECT ... WHERE status='PENDING' AND nextAttemptAt <= now()
   │             ORDER BY createdAt
   │             FOR UPDATE SKIP LOCKED
   │             LIMIT 50
   │
   ├─ group by partitionKey; process groups in parallel,
   │  items within a group strictly in order
   │
   ├─ token-bucket rate limiter against the GHL budget
   │
   ├─ POST to GHL with the idempotency key
   │
   ├─ success → status=SUCCEEDED, completedAt,
   │            SyncState.lastPushedAt + lastPushHash
   │
   └─ failure → attempts++, backoff schedule,
                DEAD after maxAttempts, alert an Admin
```

**Partition key** is `{entity}:{localId}`. Two stage changes on the same lead
must reach GHL in order; stage changes on different leads may go in parallel.

**Idempotency key** is a hash of `{operation, localId, payloadHash, attemptEpoch}`
where `attemptEpoch` changes only when the operation is genuinely re-issued by
a user, not by a retry. Retries reuse the key so GHL can discard the duplicate.

**Backoff:** 1s, 5s, 30s, 2m, 10m, 1h, 6h, 24h → DEAD.

**429 handling:** honour `Retry-After` exactly; do not apply the normal
backoff ladder, and pause the whole partition rather than the single item.

**Coalescing:** if three stage changes for the same lead are pending, the
worker may collapse them to the last one. Only permitted for idempotent
`update` operations, never for `create` or `send_document`.

---

## 4 · Inbound: webhooks

```
POST /api/webhooks/ghl
   │
   ├─ verify signature ──── invalid ──► log signatureValid=false, 200, drop
   │
   ├─ INSERT INTO webhook_events (externalId UNIQUE) ─ conflict ─► 200, DUPLICATE
   │
   ├─ return 200 within 500 ms   ◄── GHL must never wait on our processing
   │
   └─ enqueue for background processing
           │
           ├─ resolve entity by ghl*Id
           ├─ echo suppression check (§6)
           ├─ apply ONLY the fields GHL owns, per SyncFieldPolicy
           ├─ write AuditLog with syncSource='ghl', actorId=null
           └─ update SyncState.lastPulledAt, remoteVersion
```

**Always return 200 quickly**, even for events we ignore. A slow or failing
webhook endpoint causes GHL to back off and eventually disable delivery.

**Subscribed events:**

| Event | Effect |
|---|---|
| `ContactCreate` | Create a lead in NEW, start the CSR SLA timer (doc 06) |
| `ContactUpdate` | Update GHL-owned identity fields only |
| `ContactDelete` | Soft-delete the lead; retain any financial records |
| `OpportunityStatusUpdate` | Update stage **only if** the change did not originate here |
| `AppointmentCreate` / `Update` / `Delete` | Mirror the appointment; a create we did not originate sets `selfBooked = true` |
| `InvoicePaid` / `InvoicePartiallyPaid` / `InvoiceVoid` | Update invoice status and amounts; may trigger commission EARNED evaluation |
| `OrderStatusUpdate` / transaction events | Create or update the `Payment` mirror |
| Document/contract signed event | Set estimate SIGNED, create the job, create the deposit invoice, accrue commission |
| `NoteCreate` | Mirror as a non-internal `LeadNote` |
| `InboundMessage` / `OutboundMessage` | Optional: mirror as `LeadActivity` for the CSR conversation view |

**Polling fallback.** Webhooks get missed. A reconciliation job runs every
15 minutes for invoices and appointments modified in the last hour, and a
fuller nightly pass over the last 7 days. Any divergence is corrected toward
the owner and recorded in `SyncConflict`.

---

## 5 · The signature → job → invoice → commission chain

The single most important flow in the system. Every step is idempotent
because the webhook that triggers it will sometimes arrive twice.

```
GHL: customer signs the document
   │
   └─► webhook: document.signed
          │
          ├─ idempotency: if estimate.status is already SIGNED, stop.
          │
          ├─ TRANSACTION
          │    estimate.status = SIGNED, signedAt, signedByName, acceptedTier
          │    lead.stage = WON
          │    INSERT Job (stage = DEPOSIT_PAID, soldTier, site address snapshot)
          │    INSERT Invoice (deposit) with line items from the accepted tier
          │                    + snapshotCost from the line items
          │    INSERT CommissionLedger (status = ACCRUED)
          │    INSERT SyncOutbox: push opportunity → Won
          │    INSERT SyncOutbox: create GHL invoice
          │    INSERT Notification for the rep and for Admin
          │  COMMIT
          │
          └─► worker creates the invoice in GHL, stores ghlInvoiceId,
              GHL sends it, customer pays on GHL's Stripe connection
                   │
                   └─► webhook: invoice.paid
                          ├─ invoice.status = PAID, amountPaid, paidAt
                          ├─ INSERT Payment mirror
                          └─ evaluate commission EARNED:
                             requires invoice fully paid
                             AND job.adminConfirmedAt is set
```

Commission becomes `EARNED` only when **both** conditions hold, whichever
happens second. The evaluation runs on both the payment webhook and the
`job.confirm` action, and is safe to run repeatedly.

---

## 6 · Echo suppression

We push a stage change. GHL fires `OpportunityStatusUpdate` describing the
change we just made. Applied naively this either loops forever or clobbers a
newer local edit.

Three layers, all cheap:

1. **Hash comparison.** Before applying an inbound change, compare a hash of
   the incoming owned-field values against `SyncState.lastPushHash`. Identical
   means it is our own echo. Ignore it and update `lastPulledAt` only.

2. **Recency window.** If `SyncState.lastPushedAt` is within 30 seconds and
   the inbound values match what we pushed, treat it as an echo.

3. **Ownership filter.** Even a genuine inbound event only ever writes fields
   GHL owns. An echo of a stage change (APP-owned) is discarded by the
   ownership filter regardless, because inbound events are not permitted to
   write `stage` unless the change did not originate with us.

Layer 3 alone handles most cases. Layers 1 and 2 catch the rest and make the
behaviour explainable when someone is debugging at 11pm.

---

## 7 · Conflict handling

By design, conflicts on owned fields cannot happen. They happen anyway when
the ownership map is wrong, a migration lands, or someone edits directly in
the GHL UI during an outbox delay.

Detection: on inbound apply, if `SyncState.localVersion` has increased since
`lastPulledAt` **and** the inbound change touches a field we also changed, a
`SyncConflict` row is written.

Resolution: **the declared owner wins, always.** No timestamp comparison, no
merge. The losing value is preserved in the conflict row so it can be
recovered by hand.

Escalation: `SyncState.inConflict = true` surfaces the record in the Admin
sync monitor with both values and a one-click "accept remote" or "re-push
local". A rising conflict count is a signal that the ownership map needs
amending, and should be reviewed monthly.

---

## 8 · Risk register

Honest assessment. Two of these are material.

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **GHL's Documents and Contracts API does not expose everything decision D4 needs** - specifically programmatic document creation from a custom template, send, and a signed webhook | **Medium–High** | **High.** D4 depends on it. | **Spike this in week one, before any other integration work.** Verify: create document from template, populate custom values, send, receive signed webhook. If any step is missing, fall back to R1-F below. |
| **R2** | GHL invoice API cannot represent the line-item structure of a tiered estimate | Medium | Medium | Flatten the accepted tier to a simple line-item list. Tiers are a pre-sale concept; the invoice only ever reflects the tier that was accepted. |
| **R3** | Rate limits bite during initial backfill | High | Low | Backfill runs at 20% of the budget, overnight, resumable. |
| **R4** | Webhook delivery gaps | Medium | Medium | The 15-minute reconciliation poll plus a nightly full pass. |
| **R5** | Private integration token revoked or rotated in GHL | Low | High | Hourly verification ping; on failure, alert the Admin, pause the outbox rather than burning retries, show a banner. |
| **R6** | GHL changes its API version or deprecates an endpoint | Medium | Medium | Pin the `Version` header. Subscribe to GHL changelog. Keep integration code behind one `GhlClient` class so a version bump touches one file. |
| **R7** | A staff member edits a contact directly in GHL during an outbox delay | Medium | Low | Ownership map means GHL wins on identity fields anyway. |
| **R8** | Duplicate contacts in GHL creating duplicate leads | Medium | Medium | Match on `ghlContactId` first, then on normalised phone, then email. FR-CSR-14 duplicate detection on manual creation. |

### R1-F · Fallback if GHL document signing is not programmatically usable

Do not improvise this during the build. If the week-one spike fails:

1. Generate the proposal PDF in-app and upload it to GHL as a contact file, sending it through a GHL workflow. Signature is then captured by whatever GHL offers natively, and our status mirror becomes manual.
2. Or build the tokenised-link signing surface that was the runner-up option in decision D4. It is roughly two weeks of work: public route, token model, signature capture with IP and user agent, PDF generation, storage.

Present the spike result to the client with the cost of each path before
choosing. Do not let this decision be made implicitly by a developer under
deadline pressure.

---

## 9 · Initial data migration

Before launch, existing GHL data is backfilled.

| Step | Detail |
|---|---|
| 1 | **Dry run.** Pull everything to a staging database. Report counts, duplicates and records with missing required fields. Nothing is written to production. |
| 2 | **Client review.** The client confirms the mapping of their GHL pipeline stages to our `LeadStage` values. This is `GhlPipelineMapping`, and getting it wrong silently misplaces every lead. |
| 3 | **Contacts.** Backfill leads with `ghlContactId`. Rate-limited, resumable, idempotent. |
| 4 | **Opportunities.** Map to stage and assigned rep. Unmapped stages go to a quarantine list for manual decision, never guessed. |
| 5 | **Appointments.** Future appointments only. Historical calendar data stays in GHL. |
| 6 | **Invoices.** Open and recent-paid invoices, so outstanding balances are correct on day one. Cost is unknown for historical invoices; `snapshotCost` is zero and those jobs are excluded from margin reporting, which must be stated to the client rather than shown as 100% margin. |
| 7 | **Products.** Imported from the client's spreadsheet via CSV, not from GHL. GHL does not hold cost. |
| 8 | **Verification.** Row counts against GHL, spot-check 20 leads end to end, reconcile outstanding balance totals against GHL's report. |

**Point 6 deserves emphasis.** Historical jobs with no cost data will show
as pure margin unless they are explicitly excluded. Add an
`excludeFromMargin` flag or a cutover date to every margin query, and agree
the cutover date with the client in writing.
