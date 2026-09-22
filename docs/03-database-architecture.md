# 03 · Database Architecture

PostgreSQL 15+ · Prisma 5+ · single tenant (decision D1)

The complete, validated schema is `prisma/schema.prisma`. This document
explains the reasoning, reviews the first-pass table list you supplied, and
records the rules that are easy to break later if nobody wrote them down.

---

## 1 · Review of your proposed tables

Your list was organised by role. That is the right way to think about
**features** and the wrong way to think about **tables**, and it is worth
being explicit about why, because it is the single most consequential
correction in this document.

### The core correction: roles are views, not schemas

You proposed an `Auth` table under Sales Rep and another under CSR. There is
one `User` table. A Sales Rep and a CSR are the same kind of row with
different role grants. If authentication were duplicated per role you would
get four password reset flows, four session tables, and a user who changes
job function would need their account rebuilt.

The same applies to `Appointments`, which you listed under both Sales Rep and
CSR. One `Appointment` table. The CSR creates rows; the rep reads rows where
they are the owner. Role is a filter on a shared table, never a separate copy
of it.

And `Commissions calculate`, which you listed under both Admin and Sales Rep.
One `CommissionLedger`. Admin sees every row, a rep sees rows where
`userId = self`.

**Rule: tables are grouped by domain. Roles are permissions over domains.**

### Table-by-table verdict

| You proposed | Verdict | What it became, and why |
|---|---|---|
| **User – base user, common info** | Correct, kept | `User`. Exactly the instinct I would have had: identity only, no role-specific columns. |
| **Role-based table, with admin-addable roles** | Correct, expanded | `Role` + `UserRole`. `isSystem` protects the four built-ins from deletion. Custom roles are a data change, no deploy. |
| **Permission vault** | Correct, and the best idea in your list | Became three tables: `Permission` (registry), `RolePermission` (role grants), `UserPermissionOverride` (the vault itself, per-user ALLOW/DENY with expiry and reason). Detail in doc 04. |
| **Product table** | Kept, extended | `Product` + `ProductCategory` + `ProductPriceHistory` + `Supplier`. Category became a table so Admin can add one; price history is mandatory for auditing a margin dispute. |
| **Team table** | Split | Ambiguous term. It meant two things: user management (already `User` + `UserRole`) and installer crews (`Crew` + `CrewMember`). |
| **Job and invoice** | Split, firmly | `Job` and `Invoice` are different lifecycles owned by different systems. A job is ours end to end. An invoice is a mirror of GHL. One job can have several invoices (deposit, balance, change order). Never one table. |
| **Commission calculate** | Split into rule and ledger | `CommissionRule` holds the policy, `CommissionLedger` holds the money. Without that split you cannot change a rate next quarter without corrupting last quarter's history. |
| **Earnings management** | Became payouts | `Payout` + `PayoutLine`, grouping approved ledger entries into a payable batch. |
| **App-settings (CRM config, logos, white-label)** | Split three ways | `AppSetting` (namespaced key/value), `BrandingProfile` (white-label), `IntegrationCredential` (encrypted secrets). Secrets must never sit in a settings table that gets dumped into logs or a support export. |
| **Estimates table** | Kept, expanded to three | `Estimate` → `EstimateTier` → `EstimateLineItem`. Good/Better/Best cannot live on one flat estimate row. |
| **Appointments** | Kept, de-duplicated | One `Appointment` table, mirrored from GHL. |
| **Intake board** | Not a table | Intake is a **query**: leads where stage is in (NEW, CONTACTED, QUALIFIED, APPOINTMENT_SET). Building a table for a board view duplicates state and guarantees drift. |
| **"Appointments sync from GHL, also store in DB, same for others"** | Correct instinct, formalised | This is decision D2 and the whole of doc 05. Your instinct that synced data needs a local copy plus a sync record is right; it needed a field-ownership contract to be safe. |
| **Jobs list with status (Installer)** | Same table | Installer sees `Job` filtered by `installerId`. Not a separate table. |

### What was missing that you will need

These are not nice-to-haves. Each one is something that hurts badly if
discovered late.

| Added | Why it is not optional |
|---|---|
| `EstimateLineItem.unitCost` / `unitPrice` snapshots | Without these, raising a product's price rewrites the margin on every historical deal and your commission history becomes fiction. |
| `LeadAssignment` history | Your locked decision D5 makes assignment an auditable business event. "Who gave this lead to Marcus and when" must be answerable. |
| `AuditLog` | The first time a rep disputes a commission or a price looks wrong, this is the only thing that settles it. |
| `SyncOutbox`, `WebhookEvent`, `SyncState` | GHL's API will time out and GHL will deliver the same webhook twice. Without an outbox you lose writes; without a dedupe key you double-process payments. |
| `SyncFieldPolicy` | Makes decision D2 enforceable in code rather than a paragraph everyone forgets. |
| `JobStageHistory` | Cycle-time reporting and dispute resolution both need the transitions, not just the current stage. |
| `JobIssue` | Installers find subfloor damage. Without a structured channel it arrives as a phone call and disappears. |
| `MaterialOrder` | Your job pipeline has a Materials Ordered stage; a stage with no data behind it cannot answer "where is it". |
| `Invoice.snapshotCost` | Margin reporting must survive price-book edits, and GHL never holds our cost. |
| `FileAsset` | Job photos need a real storage record with checksum and thumbnail, not a filename string. |
| `Notification` + preferences | Every role needs to be told something. Bolting it on later means retrofitting every mutation. |
| `Territory`, `AssignmentRule` | Required by the fallback half of decision D5. |
| `ScheduledTask` | The SLA timer that fires auto-assignment needs durable scheduling. |

### One thing you listed that I removed

**A `Customer` role.** Your role list included it, but decision D4 puts the
customer entirely inside GHL: they receive a GHL document link, sign in GHL,
and pay on a GHL invoice page. Giving them an account here would mean a login
surface, a password reset flow and a session model for people who will use it
once. If a customer portal is wanted later it should be a separate
tokenised-link surface, not a role.

---

## 2 · Domain map

Eleven domains. Every table belongs to exactly one.

```
IDENTITY & ACCESS          CRM                        CATALOGUE
  User                       Lead                       ProductCategory
  Role                       LeadAssignment             Supplier
  Permission                 AssignmentRule             Product
  RolePermission             Territory                  ProductPriceHistory
  UserRole                   LeadNote
  UserPermissionOverride     LeadActivity             QUOTING
  UserInvitation             Appointment                Estimate
  Session / Account                                     EstimateTier
  PasswordResetToken       DELIVERY                     EstimateLineItem
  Crew / CrewMember          Job                        EstimateEvent
  AuditLog                   JobStageHistory
                             JobPhoto                 MONEY
CONFIG                       JobIssue                   Invoice
  AppSetting                 JobChecklistTemplate       InvoiceLineItem
  BrandingProfile            JobChecklistItem           Payment
  IntegrationCredential      MaterialOrder
  GhlPipelineMapping         MaterialOrderLine        COMMISSION
  GhlFieldMapping                                       CommissionRule
                           SYNC                         CommissionLedger
SUPPORT                      SyncFieldPolicy            Payout
  FileAsset                  SyncState                  PayoutLine
  Notification               SyncOutbox
  NotificationPreference     WebhookEvent
  ScheduledTask              SyncConflict
```

### The spine

```
Lead ──< Estimate ──< EstimateTier ──< EstimateLineItem
 │          │
 │          └── (signed) ──> Job ──< JobStageHistory, JobPhoto, JobIssue, MaterialOrder
 │                            │
 │                            ├──< Invoice ──< InvoiceLineItem
 │                            │       └──< Payment
 │                            └──< CommissionLedger ──> PayoutLine ──> Payout
 │
 ├──< LeadAssignment, LeadNote, LeadActivity, Appointment
```

One lead has many estimates (revisions and alternates). One signed estimate
becomes exactly one job (`Job.estimateId` is unique). One job has many
invoices (deposit, balance, change orders) and many commission entries
(accrual, and possibly a clawback).

---

## 3 · Standing rules

These are the rules that a future developer will violate unless they are
written down. Put them in the repo's CONTRIBUTING file too.

### R1 · Money is Decimal, never Float

Per-unit rates use `Decimal(14,4)` because floor pricing genuinely runs to
tenths of a cent per square foot ($2.185/SF). Totals use `Decimal(14,2)`.
Prisma returns `Decimal.js` instances; never coerce to `Number` before
arithmetic. A `parseFloat` in a total calculation is a review rejection.

### R2 · Margin is never a column

There is no `margin` field anywhere in the schema, by design and by decision
D6. It is computed as `price − cost` from snapshotted values at every read.
Adding a stored margin column will eventually disagree with its inputs.

### R3 · Costs are snapshotted onto line items

`EstimateLineItem` and `InvoiceLineItem` copy `unitCost` and `unitPrice` from
the product at creation. They are never updated afterwards, including when
the product's price changes. `Invoice.snapshotCost` holds the rolled-up total.

### R4 · Soft delete for catalogue and people, void for money

`deletedAt` exists on `User`, `Role`, `Product`, `ProductCategory`,
`Supplier`, `Crew`, `Lead`, `FileAsset`. It does **not** exist on `Invoice`,
`Payment`, `CommissionLedger`, `Payout` or `AuditLog`: those are voided with
a status and a reason, never removed. Use a Prisma client extension to append
`deletedAt: null` to every default query rather than trusting each call site.

### R5 · Every mutation writes an AuditLog row

Enforced in the service layer, not at each call site. Route handlers go
through a `withAudit()` wrapper. Webhook-originated changes set
`syncSource = 'ghl'` and leave `actorId` null.

### R6 · Denormalised columns are written in the same transaction as their source

`Lead.assignedRepId` duplicates the current `LeadAssignment`.
`EstimateTier.totalPrice` duplicates the sum of its line items. Both exist
for query performance. Both are written inside the same `prisma.$transaction`
as the source of truth. Never updated separately, never repaired by a cron.

### R7 · Nothing writes a field it does not own

Enforced by `SyncFieldPolicy`. The sync layer reads the policy and refuses
disallowed writes. Application code that needs to change a GHL-owned field
enqueues an outbox operation instead of writing locally and hoping.

### R8 · Idempotency keys on everything leaving the system

Every `SyncOutbox` row carries a unique `idempotencyKey`. Every inbound
`WebhookEvent` carries a unique `externalId`. GHL retries; we must be safe.

### R9 · No hard-coded enum values in the UI

Stage names, categories and role names come from the database or the enum
through a shared constants module. `if (stage === 'Deposit Paid')` written as
a string literal in a component is a review rejection.

---

## 4 · Indexing

The indexes in the schema are the ones the known query patterns need. The
important ones and why:

| Index | Serves |
|---|---|
| `leads(assignedRepId, stage)` | The rep pipeline board, the single most-hit query in the app |
| `leads(stage)` | CSR intake board, admin funnel |
| `leads(slaStartedAt)` | The SLA sweeper that fires fallback assignment |
| `leads(postalCode)` | Territory-based auto-assignment |
| `jobs(installerId, scheduledDate)` | Installer Today view |
| `jobs(stage)` | Admin job pipeline |
| `estimates(repId, status)` | Rep estimate list |
| `commission_ledger(userId, status)` | Rep commission view and payout batching |
| `sync_outbox(status, nextAttemptAt)` | The outbox drain query, run every few seconds |
| `sync_outbox(partitionKey, createdAt)` | Ordering guarantee per record |
| `webhook_events(externalId)` unique | Deduplication |
| `audit_logs(entity, entityId)` | The "what happened to this record" view |

**Add later, with measurements, not now:** a GIN index on `leads` for full
text search (the preview feature is enabled in the generator block), and
partial indexes such as `WHERE deleted_at IS NULL` once table sizes justify
them.

---

## 5 · Data volume and growth

Realistic figures for a single flooring company, used to sanity-check that
nothing needs partitioning at launch.

| Table | Year 1 estimate | Growth driver |
|---|---|---|
| `leads` | 3,000–6,000 | Ad spend |
| `lead_activities` | 40,000+ | Every call and text logged |
| `estimates` | 2,500 | Roughly one per qualified lead, plus revisions |
| `estimate_line_items` | 60,000 | ~8 lines × 3 tiers × 2,500 |
| `jobs` | 600–900 | Close rate on quoted work |
| `job_photos` | 6,000 | ~8 per job |
| `invoices` | 1,500 | Deposit plus balance per job |
| `audit_logs` | 250,000+ | Every mutation |
| `webhook_events` | 150,000+ | Every GHL event |
| `sync_outbox` | 100,000+ | Every push |

Nothing here needs partitioning. Two retention jobs are worth having from
month one:

- `webhook_events`: delete `PROCESSED` rows older than 90 days.
- `sync_outbox`: delete `SUCCEEDED` rows older than 30 days. Keep `DEAD` rows indefinitely.

`audit_logs` is kept for seven years and never pruned. If it becomes large,
move it to monthly partitions before you consider deleting anything.

---

## 6 · Migrations and seeding

**Migrations.** `prisma migrate dev` locally, `prisma migrate deploy` in CI.
Never `db push` against anything but a throwaway local database. Every
migration is reviewed for whether it locks a table: adding a non-null column
without a default to `leads` will lock it, so add nullable, backfill, then
tighten.

**Seed data** (`prisma/seed.ts`), run on every environment including
production at first boot:

1. `Permission` registry, the full key list from doc 04.
2. The four system `Role` rows with their permission grants.
3. `SyncFieldPolicy` rows, the full ownership map from doc 05.
4. `ProductCategory` rows.
5. Default `AppSetting` rows: timezone, deposit percentage, estimate validity, assignment mode and SLA.
6. One `BrandingProfile`.
7. The first Admin user, from environment variables, with a forced password change on first login.

Demo products, leads and jobs are a **separate** seed file
(`prisma/seed-demo.ts`) and must never run in production. Guard it with a
check on `NODE_ENV`.

---

## 7 · Backup and recovery

| Control | Target |
|---|---|
| Automated backup | Daily full, continuous WAL archiving |
| Point-in-time recovery | 30 days |
| RPO | 5 minutes |
| RTO | 4 hours |
| Restore rehearsal | Quarterly, to a scratch environment, verified by row counts and a margin reconciliation query |

A backup that has never been restored is not a backup. Put the rehearsal on
the calendar before launch, not after the first incident.
