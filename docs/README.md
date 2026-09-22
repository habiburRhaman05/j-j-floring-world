# J&J Flooring World - Production System Documentation

Version 1.0 · 22 September 2026

This set of documents specifies the production build that replaces the
click-through prototype. It is written for the engineers who will build it,
not for a client presentation.

---

## Document index

| # | Document | What it answers |
|---|---|---|
| 00 | `README.md` (this file) | Scope, locked decisions, glossary, reading order |
| 01 | `01-functional-requirements.md` | Every feature, listed per role, with FR IDs |
| 02 | `02-non-functional-requirements.md` | Performance, security, availability, offline, compliance |
| 03 | `03-database-architecture.md` | Table design, domain grouping, critique of the first-pass table list |
| 04 | `04-auth-and-permissions.md` | User model, roles, permission vault, field-level gating |
| 05 | `05-ghl-sync-architecture.md` | Field ownership map, outbox/inbox, webhooks, documents, invoices |
| 06 | `06-lead-assignment-strategy.md` | CSR review-then-assign, with automatic fallback |
| 07 | `07-role-journeys.md` | End-to-end journeys, role by role, and the cross-role lifecycle |
| 08 | `08-api-surface.md` | Endpoint list, grouped by domain, with permission per route |
| 09 | `09-implementation-roadmap.md` | Phasing, sequencing, what blocks what |
| - | `prisma/schema.prisma` | The complete schema, ready to `prisma migrate dev` |

**Reading order for a new engineer:** 00 → 07 (journeys give you the mental
model) → 03 → `schema.prisma` → 05 → 04 → 01 → 02.

---

## System in one paragraph

J&J Flooring World runs GoHighLevel as its CRM and system of record for
contacts, calendars, documents, invoices and payments. This application is a
custom layer on top of it that GHL cannot do: a cost-aware product catalogue,
a Good/Better/Best estimator with true margin calculation, an installation
job pipeline, commission accounting, and role-scoped dashboards. It is a
Next.js application over PostgreSQL via Prisma, connected to GHL through a
private integration token, syncing bidirectionally with an explicit
field-ownership contract.

---

## Locked decisions

These were decided and are not open for re-litigation during the build.
Changing any of them is a change request, not a refactor.

### D1 · Tenancy: single tenant, white-label ready
One company (J&J), one GHL location. Branding (logo, colour tokens, company
name, email footer, document header) is configurable through `AppSetting` and
`BrandingProfile` so the product can be resold later, but **no `companyId`
column exists on any table**. Migrating to multi-tenant later is one additive
migration plus a query-scoping middleware, which is cheaper than carrying
unused tenant plumbing now.

### D2 · Sync conflict resolution: field-level ownership
Every synchronised field has exactly one declared owner, App or GHL. The
non-owner may read and display it but never writes it back. This makes most
conflicts structurally impossible rather than resolved after the fact. The
authoritative map lives in `05-ghl-sync-architecture.md` and is enforced in
code by the `SyncFieldPolicy` table, which is seeded, not hand-maintained.

Headline split:
- **GHL owns:** contact identity, calendar/appointments, documents and
  signatures, invoices, payments, conversations, pipeline opportunity record.
- **App owns:** products and cost, estimate line items and tiers, margin,
  job pipeline and installer state, commission, internal notes, assignment.

### D3 · Payments: GHL invoices on GHL's Stripe connection
No direct Stripe integration in this application. Invoices are created in GHL
through the API, the customer pays through GHL's hosted payment page on the
Stripe account already connected to the GHL location, and payment state
arrives back by webhook. Our `Invoice` and `Payment` rows are **mirrors**:
they are read-authoritative for reporting and margin, and write-authoritative
for nothing. Staff can record an offline payment (cash, check) in our UI,
which pushes to GHL as a manual payment record.

### D4 · E-signature: GHL Documents and Contracts
Proposals are generated as GHL documents through the private integration and
sent from GHL. The signature, the signed PDF, the audit trail and the legal
record all live in GHL. We store `ghlDocumentId`, the status, the signer name,
the signed timestamp and a URL. We do not store or re-render the signature.
**Risk flagged:** GHL's Documents and Contracts API surface is thinner than
its invoice API. See the risk register in `05` for the mitigation and the
fallback if a needed endpoint turns out not to exist.

### D5 · Lead assignment: CSR reviews, then assigns
A new lead lands in the CSR intake board unassigned. A CSR qualifies it and
assigns it to a Sales Rep. Automatic assignment exists and is fully built, but
runs as a **fallback on an SLA timer**, not as the primary path. Both
strategies are permanently in the codebase and switchable per-source in
settings. Full design in `06-lead-assignment-strategy.md`.

### D6 · Margin is never stored as an editable field
Margin is derived from cost and price at every read. Estimate and invoice line
items snapshot `unitCost` and `unitPrice` at the moment of quoting, so a later
price-book edit never rewrites the margin on a signed historical deal.

### D7 · Cost visibility is a server-side permission, not a UI concern
`product.cost.read` and `financials.margin.read` are real permissions checked
in the API serializer. A Sales Rep hitting the API directly receives a
response object with no cost keys in it at all. The UI cannot leak what the
API never sent.

---

## Technology stack

| Layer | Choice | Note |
|---|---|---|
| Runtime | Node.js 20 LTS | |
| Framework | Next.js 14+ App Router | Server Actions for mutations, RSC for reads |
| Language | TypeScript, `strict: true` | |
| Database | PostgreSQL 15+ | |
| ORM | Prisma 5+ | |
| Auth | Auth.js (NextAuth) with database sessions | Credentials + optional Google |
| Validation | Zod, shared client and server | |
| Background jobs | BullMQ on Redis, or pg-boss if Redis is unwanted | Sync outbox, SLA timers, retries |
| File storage | S3-compatible (AWS S3 or Cloudflare R2) | Job photos, cached PDFs |
| Email/SMS | Through GHL, not a separate provider | Keeps conversation history in one place |
| Hosting | Vercel or a container host | Background workers need a persistent process; Vercel needs a separate worker |

**Note on hosting:** the sync outbox and SLA timers require a long-running
worker. If Vercel is the host, the worker runs separately (Railway, Fly,
ECS). Do not attempt to run the outbox on serverless cron alone; retry
semantics get unreliable.

---

## Glossary

| Term | Meaning here |
|---|---|
| **Lead** | A person who has expressed interest. Mirrors a GHL Contact. Our table is `Lead`, keyed to `ghlContactId`. |
| **Opportunity** | GHL's sales pipeline record for a lead. We mirror stage only. |
| **Estimate** | Our quote document containing up to three tiers. Not a GHL object until it becomes a GHL document. |
| **Tier** | Good, Better or Best. A named bundle of line items inside one estimate. |
| **Job** | Work to be installed, created when an estimate is signed. Purely ours; GHL has no equivalent. |
| **Job pipeline** | Deposit Paid → Materials Ordered → Ready to Schedule → Scheduled → Installation (En Route, In Progress) → Completed. Separate from the sales pipeline. |
| **Permission vault** | The per-user grant/deny override layer that sits on top of role permissions. |
| **Outbox** | Durable queue of changes waiting to be pushed to GHL. |
| **Field ownership** | The declared rule stating which system may write a given field. |
| **Snapshot** | A copy of a price or cost frozen onto a line item at quote time. |

---

## What is deliberately out of scope for v1

Listed so nobody assumes they are coming.

- Direct Stripe, QuickBooks or Xero integration.
- Inventory or warehouse stock levels. `MaterialOrder` tracks ordering status only, not quantity on hand.
- Customer-facing login portal. Customers interact through GHL links only.
- Route optimisation or GPS tracking of installers.
- Native mobile apps. The installer view is a responsive PWA.
- Multi-currency and multi-language.
- Subcontractor payments and 1099 generation.
