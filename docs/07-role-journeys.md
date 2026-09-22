# 07 · End-to-End Role Journeys

Read this first if you are new to the system. The lifecycle below is the
whole product; everything else is detail.

---

## 1 · The complete lifecycle, one lead

A single lead, from Facebook ad to paid commission, showing which role acts,
which system holds the truth, and what is written.

```
 ┌─ GHL ──────────────────────────────────────────────────────────────┐
 │  Customer submits a Facebook lead form                             │
 │  GHL creates a Contact                                             │
 └────────────────────────┬───────────────────────────────────────────┘
                          │ webhook: ContactCreate
                          ▼
 ┌─ APP ──────────────────────────────────────────────────────────────┐
 │  Lead created, stage NEW, unassigned                               │
 │  SLA timer starts (30 min, business hours only)                    │
 │  CSRs notified                                                     │
 └────────────────────────┬───────────────────────────────────────────┘
                          ▼
 ╔═ CSR ══════════════════════════════════════════════════════════════╗
 ║  1. Sees the lead on the intake board with an SLA countdown        ║
 ║  2. Calls. Logs the outcome. Stage → CONTACTED                     ║
 ║  3. Qualifies: 1,180 SF main floor LVP, budget confirmed           ║
 ║     Stage → QUALIFIED                                              ║
 ║  4. ASSIGNS to Marcus (decision D5). Suggested rep shown;          ║
 ║     CSR accepts or overrides. SLA timer cancelled.                 ║
 ║  5. Books the measure on Marcus's GHL calendar → Thursday 10am     ║
 ║     Stage → APPOINTMENT_SET                                        ║
 ╚════════════════════════╤═══════════════════════════════════════════╝
           │ push: opportunity stage + owner    │ push: appointment
           ▼                                     ▼
       [ GHL opportunity updated ]        [ GHL calendar booked ]
                          │
                          ▼
 ╔═ SALES REP ════════════════════════════════════════════════════════╗
 ║  6. Sees the lead on their pipeline board and the measure on       ║
 ║     their appointment list                                         ║
 ║  7. Attends. Logs a site-visit activity with measurements          ║
 ║  8. Builds the estimate: picks products from the Products,       ║
 ║     sets quantities, across Good / Better / Best                   ║
 ║     SEES PRICE ONLY. Cost and margin are not in the payload.       ║
 ║  9. Sends it → generates a GHL document and sends for signature    ║
 ║     Stage → ESTIMATE_SENT                                          ║
 ╚════════════════════════╤═══════════════════════════════════════════╝
                          │ push: create + send document
                          ▼
 ┌─ GHL ──────────────────────────────────────────────────────────────┐
 │  Customer opens the document, picks Best, types their name, signs  │
 │  GHL holds the signature, the PDF and the legal audit trail        │
 └────────────────────────┬───────────────────────────────────────────┘
                          │ webhook: document.signed
                          ▼
 ┌─ APP · one transaction ────────────────────────────────────────────┐
 │  Estimate  → SIGNED, acceptedTier = BEST                           │
 │  Lead      → WON                                                   │
 │  Job       created, stage DEPOSIT_PAID, site address snapshotted   │
 │  Invoice   created (deposit), line items + snapshotCost            │
 │  Commission→ ACCRUED for Marcus                                    │
 │  Outbox    → push opportunity Won; create GHL invoice              │
 │  Notify    → Marcus, Admin                                         │
 └────────────────────────┬───────────────────────────────────────────┘
                          ▼
 ┌─ GHL ──────────────────────────────────────────────────────────────┐
 │  Invoice sent. Customer pays the deposit on GHL's Stripe account   │
 └────────────────────────┬───────────────────────────────────────────┘
                          │ webhook: invoice.partially_paid
                          ▼
 ╔═ ADMIN ════════════════════════════════════════════════════════════╗
 ║ 10. Sees the job in Deposit Paid                                   ║
 ║ 11. Orders materials → stage MATERIALS_ORDERED                     ║
 ║ 12. Materials arrive → READY_TO_SCHEDULE                           ║
 ║ 13. Assigns Tony and a date → SCHEDULED                            ║
 ╚════════════════════════╤═══════════════════════════════════════════╝
                          ▼
 ╔═ INSTALLER ════════════════════════════════════════════════════════╗
 ║ 14. Job appears in Today. Scope of work, no prices.                ║
 ║ 15. Confirms materials received. Photographs Before.               ║
 ║ 16. Mark En Route → Mark In Progress                               ║
 ║ 17. Photographs Completion. Customer signs off on the device.      ║
 ║ 18. Mark Completed  (blocked without materials + a photo)          ║
 ╚════════════════════════╤═══════════════════════════════════════════╝
                          ▼
 ╔═ ADMIN ════════════════════════════════════════════════════════════╗
 ║ 19. Reviews photos. Confirms completion → adminConfirmedAt         ║
 ║ 20. Sends the balance invoice                                      ║
 ╚════════════════════════╤═══════════════════════════════════════════╝
                          ▼
 ┌─ GHL ─── customer pays balance ─── webhook: invoice.paid ──────────┐
                          ▼
 ┌─ APP ──────────────────────────────────────────────────────────────┐
 │  Invoice PAID. Payment mirrored.                                   │
 │  Both conditions now true (paid AND confirmed)                     │
 │  → Commission EARNED                                               │
 └────────────────────────┬───────────────────────────────────────────┘
                          ▼
 ╔═ ADMIN ════════════════════════════════════════════════════════════╗
 ║ 21. Approves the commission → APPROVED                             ║
 ║ 22. Creates the month's payout batch, approves it, marks it paid   ║
 ║     → PAID                                                         ║
 ╚════════════════════════════════════════════════════════════════════╝
```

**Two things to notice.** First, the customer never logs into this
application. Every customer touchpoint is a GHL surface. Second, commission
requires two independent confirmations (money received, work confirmed), and
neither alone is sufficient.

---

## 2 · CSR journey

**Who they are.** Answers the phone, works the intake board, books measures.
Often the first human the customer speaks to. Sees no money.

### Morning

Opens the intake board. Four columns: New, Contacted, Qualified, Appointment
Set. Leads that arrived overnight sit in New, each with an SLA countdown.
Anything auto-assigned overnight by the timer is flagged so they can review
whether the routing was right.

### Working a lead

1. Open the card. Contact details, source, the scope text from the form, and the GHL conversation thread inline.
2. Call. Log the outcome with one click: answered, voicemail, no answer, wrong number, not interested.
3. A voicemail or answered call moves New → Contacted automatically. The CSR never has to remember to move the card.
4. Qualify in conversation: what rooms, roughly what size, what timeline, budget range. Free-text into `scopeSummary`.
5. Mark Qualified.

### Assigning (the locked decision)

6. Click Assign. The rep table shows open load, leads today, close rate, territory match, next calendar availability and status.
7. A suggested rep is pre-selected with a one-line reason. Accept, or override and pick someone else.
8. Assign and Book in one action: the assignment is written and the booking step opens immediately.
9. Pick a slot from the rep's real GHL availability. The appointment is created in GHL and mirrors back. Stage → Appointment Set.

### What they cannot do

Open an estimate. See a price, a cost, a margin, an invoice, a payment or a
commission figure. Move a lead past Appointment Set. There is no permission
in the CSR role that touches money, so there is nothing to leak.

---

## 3 · Sales Rep journey

**Who they are.** Measures, quotes, closes. Paid on commission. Sees
customer-facing prices, never cost or margin, never another rep's work.

### Pipeline

Their board shows only their own leads. Counts and value per stage. Won is
not draggable: the only path to Won is a signature.

### Before the appointment

Reviews the CSR's notes and scope summary. Sees the appointment on their list
with address and time.

### On site

Measures. Logs a site-visit activity. Opens the estimate builder, which can
be used on a phone.

### Building the estimate

1. Search the Products by name or category. Price per unit is shown. **Cost is not in the API response for this role.**
2. Add lines to a tier with quantities. Totals update live.
3. Build Good first, duplicate it to Better, upgrade the material, repeat for Best. Duplication is what makes three tiers practical in the field rather than a nice idea.
4. Optional discount, bounded by their `estimate.discount.apply` constraint. Over the limit, it routes to an Admin for approval rather than being silently blocked.
5. Set the deposit percentage and validity date.
6. Save as draft, or send.

### Sending and signing

7. Send generates the GHL document and sends it. Lead → Estimate Sent.
8. The rep watches status change as GHL reports it: sent, viewed, signed.
9. On signature the rep is notified, the lead is Won, and a job exists.

### After the sale

The rep keeps read-only visibility of their won jobs: stage, scheduled date,
installer name, materials status, payment status. This exists so that when
the customer calls the rep directly, which they always do, the rep can answer
without phoning the office.

### Commission

Their own numbers only: accrued, earned, approved, paid, with the per-job
breakdown and the rule that produced each figure. Note the caveat in
FR-REP-17: on a margin-based plan, a rep can infer margin from their own
commission. That is accepted. If the client wants margin genuinely opaque,
the commission basis must be contract revenue.

---

## 4 · Installer journey

**Who they are.** In a house, on a phone, often with bad signal, sometimes
with gloves on. Sees scope and schedule. Sees no money at all.

### Start of day

Opens Today. Jobs in arrival order: customer name, address, arrival window,
stage, materials status. One tap for directions, one tap to call.

### On arrival

1. Mark En Route on the way, Mark In Progress on arrival. Only the single next valid action is ever enabled, so there is nothing to get wrong.
2. Review scope of work: product names, quantities, units. No prices anywhere.
3. Read access notes: gate code, dog, where to park.
4. Confirm materials received, with a note if something is short or damaged.
5. Photograph Before.

### During

6. Tick checklist items if the job type has a template.
7. Photograph Progress as they go.
8. If something is wrong (subfloor damage, wrong material), Report Issue. The office is notified immediately and the job is flagged. This replaces a phone call that otherwise leaves no record.

### Finishing

9. Photograph Completion.
10. Walk the customer through it and capture a typed sign-off on the device. This is an internal completion record, distinct from the contract signature in GHL.
11. Mark Completed. **Blocked** unless materials are confirmed and at least one completion photo exists.

### No signal

Everything above works offline. Status changes, notes, checklist ticks and
photos queue on the device with a visible pending count, and flush in order
when signal returns. Each queued item carries an idempotency key so a retry
cannot double-apply.

---

## 5 · Admin journey

**Who they are.** Owner or office manager. Sees everything.

### Daily

Dashboard: revenue, cost, margin, collected, outstanding, for the chosen
period. Funnel and job pipeline underneath. Outstanding balances with ageing.
Sync health panel, which should be boring.

### Operations

- **Jobs.** Every job with full financials. Order materials, mark received, assign installer and date, override any stage with a reason.
- **Issues.** Open installer issues, by severity. Acknowledge and resolve.
- **Completion confirmation.** Review the photos, confirm, which is one of the two conditions for commission earning.
- **Invoices.** Create and send through GHL, watch payment state arrive by webhook, record offline payments, resync one invoice by hand if it looks wrong.

### Products

Add and edit products, deactivate rather than delete, bulk-adjust prices with
a margin preview before committing, import and export by CSV with a dry run
first. Every cost or price change writes a history row with who and when.

### Team and permissions

Invite users, assign roles, suspend. Build custom roles from the permission
registry. Use the vault to grant one person one extra permission, with a
reason and an expiry, and see the effective permission set for any user
before saving.

### Money

Define commission rules (flat, tiered by margin, or flat amount; on revenue
or on margin; with effective dates). Review the ledger. Approve earned
commission. Build, approve and pay the monthly payout batch. Export for the
bookkeeper.

### Settings

GHL connection and token, pipeline and custom-field mapping, white-label
branding, business defaults, lead assignment mode and SLA, and the sync
monitor with retry and dead-letter handling.

---

## 6 · Cross-role handoffs

The seams are where systems fail. Each of these is a deliberate contract.

| Handoff | Trigger | Guarantee |
|---|---|---|
| **GHL → CSR** | ContactCreate webhook | Lead is on the intake board within the sync interval, with an SLA timer running |
| **CSR → Sales Rep** | CSR assigns | Rep is notified; assignment is recorded with actor, strategy and reason; the opportunity owner is pushed to GHL |
| **Timer → Sales Rep** | SLA expiry | Auto-assignment with full strategy context recorded; CSR and Admin notified that it happened |
| **Sales Rep → Customer** | Send estimate | GHL document created and sent; status mirrors back without polling the UI |
| **Customer → System** | Signature in GHL | One transaction creates job, invoice and commission accrual; idempotent against duplicate webhooks |
| **System → Admin** | Job created | Job appears in Deposit Paid awaiting materials |
| **Admin → Installer** | Schedule | Job appears in the installer's Today or My Jobs with address, scope and access notes |
| **Installer → Admin** | Mark Completed | Admin gets a confirmation task with the photos attached |
| **Admin → Rep** | Confirm + payment | Commission flips ACCRUED → EARNED only when both are true |

---

## 7 · Failure paths

Journeys that do not end in a sale, which is most of them.

| Path | Behaviour |
|---|---|
| Lead never answers | CSR logs attempts; after the configured number, disqualify with NO_RESPONSE. Stage → LOST. SLA timer cancelled. |
| Customer declines the estimate | GHL reports declined; estimate → DECLINED, lead → FOLLOW_UP (not LOST, because a decline is a negotiating position). Rep gets a follow-up task. |
| Estimate expires | `validUntil` passes; estimate → EXPIRED, lead → FOLLOW_UP, rep notified. |
| Rep revises the quote | New estimate version; the previous one is SUPERSEDED, not overwritten. Both remain readable. |
| Deposit never paid | Job sits in DEPOSIT_PAID with an unpaid invoice. Admin dashboard ages it. After the configured period, Admin may cancel the job, which voids the invoice and reverses the commission accrual. |
| Installer finds a blocking issue | JobIssue at BLOCKING severity; job holds at IN_PROGRESS; Admin notified urgently. Resolution may become a change order (FR-ADM-35), producing a supplementary invoice and a commission adjustment. |
| Customer refunds or charges back | GHL reports it; payment status updates; commission is CLAWED_BACK with a reason; the ledger still reconciles because the clawback is a new row rather than an edit. |
| Job cancelled after materials ordered | Admin cancels with a reason. Invoice voided for the unpaid portion. Commission clawed back. Material order status set to cancelled. |
