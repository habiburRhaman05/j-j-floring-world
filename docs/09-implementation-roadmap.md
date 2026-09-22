# 09 · Implementation Roadmap

Phasing, sequencing and what blocks what. Durations assume two full-time
engineers, one full-stack lead and one mid-level, plus part-time design.
Adjust proportionally; the **sequence** matters more than the numbers.

---

## Phase 0 · Integration spike (week 1)

**Do this before writing any application code.** It is the only phase whose
outcome can invalidate a locked decision.

| Task | Verifies |
|---|---|
| Obtain the GHL private integration token and location ID | Access exists at all |
| Enumerate contacts, opportunities, pipelines, calendars | Read path works |
| Create a contact, update a custom field, move an opportunity stage | Write path works |
| **Create a document from a template, populate custom values, send it, receive the signed webhook** | **Decision D4. Risk R1.** |
| Create an invoice with line items, send it, pay it in test mode, receive the paid webhook | **Decision D3.** |
| Register webhooks, verify the signature, measure delivery latency | Inbound path works |
| Measure actual rate limits under load | NFR budget |

**Exit criteria.** A written spike report stating, per endpoint, whether it
exists, what it returns and what it costs in API calls. If the document
signing flow does not work end to end, escalate to the client immediately
with the R1-F fallback options and their costs (doc 05, §8). Do not proceed
into Phase 2 on an assumption.

---

## Phase 1 · Foundation (weeks 2–3)

Nothing else can start without this.

- Next.js project, TypeScript strict, ESLint, Prettier, CI pipeline
- PostgreSQL provisioned, Prisma installed, **the full schema migrated in one go** (it is designed as a whole; migrating it piecemeal invents dependency problems that do not exist)
- Seed: permissions, four system roles, sync field policies, categories, default settings, branding, first admin
- Auth.js with database sessions, Argon2id, login, logout, password reset, invitation acceptance
- Permission resolution, the `withAuth` guard, row-scope helpers, the serializer pattern
- App shell: header, role-aware navigation, toast and modal primitives, empty and loading states
- Design tokens carried over from the prototype

**Exit criteria.** A user can be invited, accept, log in, and see a role-aware
empty shell. The permission regression test harness (NFR-MNT-06) exists and
passes trivially.

---

## Phase 2 · Sync foundation (weeks 4–5)

Before any feature writes to GHL, the machinery that carries those writes
must exist. Building features first and retrofitting sync is the most common
way this kind of project goes wrong.

- `GhlClient`: one class, token from `IntegrationCredential`, rate limiter, retries, typed responses
- Outbox worker: partitioned, ordered, backoff, dead-letter
- Webhook endpoint: signature verification, dedupe, fast 200, background processing
- `SyncFieldPolicy` enforcement in the sync layer
- Echo suppression
- Reconciliation jobs, 15-minute and nightly
- Admin sync monitor: outbox depth, failures, retry, conflicts
- Contact and opportunity sync end to end, both directions

**Exit criteria.** A lead created in GHL appears locally within the interval.
A stage change made locally appears in GHL. Replaying 24 hours of webhooks
changes nothing. Killing the worker mid-flight loses no writes.

---

## Phase 3 · CRM and intake (weeks 6–7)

The CSR is now fully functional. This is the first phase the client can use
for real work.

- Lead list, board and detail
- Notes and activity logging with quick actions
- CSR intake board with SLA countdown
- **Assignment: the CSR screen with load, close rate, territory and suggestion** (decision D5)
- Assignment rules, territories, the SLA scheduler and the fallback strategies
- Appointment booking against GHL calendars, with availability
- Duplicate detection and merge
- Notification centre

**Exit criteria.** A lead flows from GHL to the intake board, is worked,
assigned and booked, with the opportunity and calendar updated in GHL. The
SLA timer fires correctly and is observably skipped outside business hours.

---

## Phase 4 · Catalogue and estimating (weeks 8–10)

The commercial core, and the phase most worth spending extra time on.

- Product CRUD, categories, suppliers, price history
- Bulk price adjustment with margin preview; CSV import and export with dry run
- Estimate builder: catalogue search, three tiers, line items with snapshotting, tier duplication
- Discounts with vault constraints and the approval path
- Estimate versioning and superseding
- **GHL document generation, sending and signed-webhook handling** (D4)
- The signature transaction: estimate signed → lead won → job created → invoice created → commission accrued, idempotent
- Rep pipeline, estimate list, appointment list

**Exit criteria.** A rep builds a three-tier estimate, sends it, the customer
signs in GHL, and a job, an invoice and a commission accrual exist. The
permission regression test confirms zero cost or margin keys in any rep
response.

---

## Phase 5 · Delivery and installer (weeks 11–12)

- Job list, detail, stage machine with sequential validation
- Scheduling, installer and crew assignment
- Material orders
- Photo capture: presigned upload, client-side downscale, EXIF strip, thumbnails
- Issue reporting and resolution
- Checklists
- Installer PWA: Today, My Jobs, Completed, mobile-first
- **Offline queue** (NFR-OFF-01 to 08) and the `/jobs/sync` flush endpoint
- Admin completion confirmation

**Exit criteria.** An installer completes a job end to end on a phone in
aeroplane mode and everything lands correctly on reconnection, in order,
without duplication.

---

## Phase 6 · Money and reporting (weeks 13–14)

- Invoice creation in GHL, sending, status mirroring, offline payment recording
- Payment mirror and reconciliation
- Commission rules, including tiered-by-margin, and the rule preview endpoint
- Commission ledger with the full state machine and clawbacks
- Payout batches, approval, export
- Admin dashboards: company financials, funnel, job pipeline, leaderboard, ageing
- Rep commission view
- CSV exports

**Exit criteria.** The full lifecycle in doc 07 §1 runs end to end, and the
commission ledger reconciles against invoices to the cent.

---

## Phase 7 · Hardening and launch (weeks 15–16)

- Accessibility pass to WCAG 2.1 AA, axe-core in CI plus manual keyboard testing
- Performance pass against the NFR targets with realistic seeded volumes
- **External penetration test focused on the permission model**
- Error tracking, metrics, alerts, uptime monitoring
- Runbook: token rotation, outbox drain, webhook replay, break-glass admin, restore
- **Backup restore rehearsal**, verified by row counts and a margin reconciliation
- Data migration dry run, client review of pipeline mapping, then the real backfill
- User training per role, with a short screen recording each
- Soft launch: CSR and one rep only, for one week, before full rollout

---

## Dependency graph

```
Phase 0 spike
   │ (can invalidate D4 → escalate before Phase 4)
   ▼
Phase 1 foundation
   ▼
Phase 2 sync ─────────────┐
   ▼                      │
Phase 3 CRM/intake        │
   ▼                      │
Phase 4 catalogue+estimate│  (needs D4 confirmed by Phase 0)
   ▼                      │
Phase 5 jobs/installer    │
   ▼                      │
Phase 6 money ◄───────────┘  (needs D3 confirmed by Phase 0)
   ▼
Phase 7 hardening
```

Phases 3, 4, 5 and 6 are strictly sequential on data dependencies: there is
no job without a signed estimate, no commission without a job. The only
genuine parallelism is design work and the installer PWA shell, which can be
built during Phase 4.

---

## What can be cut, and what cannot

If the timeline compresses, cut from the bottom of this list, not the top.

**Cannot be cut without breaking the system**

- The outbox and webhook idempotency. Without them, data loss is certain rather than possible.
- Cost snapshotting on line items. Retrofitting it means historical margin is permanently wrong.
- The permission serializer. Bolting it on later means auditing every endpoint twice.
- Audit logging. Adding it later leaves a blind period exactly when the system is least stable.
- The assignment SLA fallback. Without it, every out-of-hours lead waits until morning.

**Can be deferred to a second release**

- Offline queue (NFR-OFF). Ship the installer view online-only, with a clear message when the connection drops, and add the queue in the following release. Set expectations with the client explicitly, because installers will hit this in week one.
- Checklists (FR-INS-16)
- Change orders (FR-ADM-35)
- Bulk price adjustment (FR-ADM-15) and CSV import (FR-ADM-16). Manual entry is tolerable for a few hundred products.
- Product performance and lead source reports (FR-ADM-07, 08)
- Crews (FR-ADM-26). Assign individuals first.
- Conversation view (FR-CSR-16). Staff can open GHL in a tab.
- Tiered-by-margin commission. Ship flat percentage first.
- Two-factor authentication for non-Admin users.

**Do not cut, though it will be tempting**

The completion-photo requirement on FR-INS-09. It is the only evidence the
business has when a customer disputes workmanship three months later, and
installers will lobby to have it removed as soon as it slows them down once.

---

## Team and estimate

| Role | Allocation |
|---|---|
| Full-stack lead | Full time, 16 weeks |
| Full-stack mid | Full time, weeks 2–16 |
| Design | Half time, weeks 1–10 |
| QA | Half time, weeks 8–16 |
| Client SME | ~4 hours per week, non-negotiable for mapping decisions and UAT |

**Headline: 16 weeks to launch** with the deferrable list above included. Cut
that list and it is 13 weeks, with the second release covering the remainder.

The client SME time is the most commonly underestimated line. The pipeline
mapping decision (doc 05 §9 step 2), the commission plan and the price book
import all require someone who knows the business and can decide. Without
that person available, the timeline slips regardless of engineering capacity.
