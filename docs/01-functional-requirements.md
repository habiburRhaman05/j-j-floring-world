# 01 · Functional Requirements

Every feature the system must provide, grouped by role. IDs are stable and
referenced from the API surface doc and the test plan.

**ID format:** `FR-<ROLE>-<NN>`. Roles: `ADM` Admin, `REP` Sales Rep,
`CSR` Customer Service Rep, `INS` Installer, `SYS` cross-cutting system
behaviour, `PUB` unauthenticated/public surface.

**Priority:** `M` must-have for launch · `S` should-have · `C` could-have,
deferred without blocking launch.

---

## Cross-cutting (all roles)

| ID | Priority | Requirement |
|---|---|---|
| FR-SYS-01 | M | A user signs in with email and password. Session is a database session with a rolling 12-hour idle expiry and 30-day absolute expiry. |
| FR-SYS-02 | M | A user holds one or more roles. Where a user holds several, the UI presents a role switcher and the active role scopes the entire session view. |
| FR-SYS-03 | M | Every mutation writes an `AuditLog` row capturing actor, entity, action, before and after JSON, IP and user agent. |
| FR-SYS-04 | M | Every screen renders only data the active role is permitted to see. Field-level restrictions are enforced server-side; forbidden fields are absent from the API response, not hidden client-side. |
| FR-SYS-05 | M | The system displays an in-app notification centre. Notification types and per-user channel preferences (in-app, email, SMS) are configurable. |
| FR-SYS-06 | M | Global search across leads, jobs, estimates and invoices, scoped to what the active role may see. |
| FR-SYS-07 | S | Every list view supports server-side pagination, sorting, filtering and CSV export where the role has export permission. |
| FR-SYS-08 | M | A user can reset a forgotten password by emailed single-use token valid for 30 minutes. |
| FR-SYS-09 | S | Optional TOTP two-factor authentication, mandatory for any user holding the Admin role. |
| FR-SYS-10 | M | All timestamps are stored UTC and displayed in the company timezone from `AppSetting`. |

---

## Admin

The Admin role is unrestricted. It sees cost, margin, commission and every
other user's data.

### Dashboard and reporting

| ID | Priority | Requirement |
|---|---|---|
| FR-ADM-01 | M | Company dashboard showing contracted revenue, cost of goods, gross margin and margin percentage, for a selectable date range. |
| FR-ADM-02 | M | Cash view: total collected, total outstanding, ageing buckets (current, 1–30, 31–60, 60+ days). |
| FR-ADM-03 | M | Sales funnel by stage with count and total value per stage, and stage-to-stage conversion rate. |
| FR-ADM-04 | M | Job pipeline overview by stage with count and contract value per stage. |
| FR-ADM-05 | M | Per-job profitability: contract price, snapshot cost, realised margin, margin percentage, and variance against the estimate. |
| FR-ADM-06 | M | Sales rep leaderboard: deals won, deals lost, close rate, revenue written, average deal size, average margin percentage, commission owed. |
| FR-ADM-07 | S | Product performance report: units sold, revenue, margin contribution, by product and by category. |
| FR-ADM-08 | S | Lead source report: leads, cost per lead where ad spend is entered, conversion rate and revenue by source. |
| FR-ADM-09 | S | Installer performance: jobs completed, average days from scheduled to completed, rework/issue photo count. |
| FR-ADM-10 | C | Saved report views and scheduled email delivery of a report. |

### Product and pricing database

| ID | Priority | Requirement |
|---|---|---|
| FR-ADM-11 | M | Create, edit and deactivate products. Products are never hard-deleted; deactivation removes them from new estimates but preserves history. |
| FR-ADM-12 | M | A product carries name, SKU, category, unit of measure, cost per unit, price per unit, optional tier affinity, optional supplier, and active flag. |
| FR-ADM-13 | M | Margin and margin percentage are displayed as computed values and cannot be typed into directly. |
| FR-ADM-14 | M | Every change to `costPerUnit` or `pricePerUnit` writes a `ProductPriceHistory` row with the old value, new value, actor and effective timestamp. |
| FR-ADM-15 | S | Bulk price adjustment: apply a percentage or fixed change to a filtered set of products, with a preview of the resulting margins before committing. |
| FR-ADM-16 | S | CSV import and export of the price book, with a dry-run validation pass that reports row-level errors before any write. |
| FR-ADM-17 | S | Product categories are a managed table, so new categories can be added without a code change. |
| FR-ADM-18 | C | Supplier records and per-supplier cost, so the same product can be sourced at two costs. |

### Team, roles and permissions

| ID | Priority | Requirement |
|---|---|---|
| FR-ADM-19 | M | also keep temporrty login using email and passwor dthat will be give admin , Invite a user by email. The invitation carries the roles to be granted and expires after 7 days. |
| FR-ADM-20 | M | Assign and revoke roles on a user. A user may hold multiple roles. |
| FR-ADM-21 | M | Suspend and reactivate a user. Suspension terminates all active sessions immediately. |
| FR-ADM-22 | M | Create a **custom role** with a chosen set of permissions, cloned from an existing role or built from scratch. |
| FR-ADM-23 | M | System roles (Admin, Sales Rep, CSR, Installer) cannot be deleted, and the Admin role's permission set cannot be reduced below the set required to administer roles, to prevent lockout. |
| FR-ADM-24 | M | Grant or deny an individual permission to a single user, overriding their role. The override may carry an expiry date and a required reason. This is the permission vault. |
| FR-ADM-25 | M | A permission matrix screen showing roles against permissions, with the effective result for any selected user. |
| FR-ADM-26 | S | Create installer crews and assign installers to a crew. Jobs may be assigned to a crew rather than an individual. |
| FR-ADM-27 | S | Set per-user working hours and capacity, used by the load-balanced assignment strategy. |

### Jobs and invoices

| ID | Priority | Requirement |
|---|---|---|
| FR-ADM-28 | M | View every job regardless of assignment, with full financials. |
| FR-ADM-29 | M | Move a job to any stage manually, with an optional reason recorded in `JobStageHistory`. |
| FR-ADM-30 | M | Assign an installer or crew and set the scheduled date and arrival window. |
| FR-ADM-31 | M | Record material order status per job: not ordered, ordered, partially received, received, backordered, with expected arrival date. |
| FR-ADM-32 | M | Generate an invoice in GHL from a signed estimate, and send it. |
| FR-ADM-33 | M | View invoice and payment state mirrored from GHL, including partial payments, with a manual resync action. |
| FR-ADM-34 | M | Record an offline payment (cash or check), which is pushed to GHL as a manual payment. |
| FR-ADM-35 | S | Issue a change order against a signed job: add or remove line items, producing a supplementary invoice and adjusting margin and commission. |
| FR-ADM-36 | S | Cancel a job with a reason, which voids the remaining balance and claws back unearned commission. |
| FR-ADM-37 | M | Confirm job completion after the installer marks it complete, which is the event that makes commission earned. |

### Commission and earnings

| ID | Priority | Requirement |
|---|---|---|
| FR-ADM-38 | M | Define commission rules: flat percentage, or tiered by margin percentage band, per user or per role, with an effective date range. |
| FR-ADM-39 | M | Choose the commission basis per rule: contract revenue or gross margin. |
| FR-ADM-40 | M | View the commission ledger: every accrual, its state (accrued, earned, approved, paid, clawed back) and the job it came from. |
| FR-ADM-41 | M | Commission accrues on signature, becomes earned when the invoice is fully paid and the job is confirmed complete, and requires Admin approval before it can be included in a payout. |
| FR-ADM-42 | M | Create a payout batch for a period, review its lines, approve it and mark it paid. |
| FR-ADM-43 | M | Automatic clawback of earned commission when a job is cancelled or a payment is refunded. |
| FR-ADM-44 | S | Export a payout batch as CSV for the bookkeeper. |

### Application settings

| ID | Priority | Requirement |
|---|---|---|
| FR-ADM-45 | M | GHL connection: store the private integration token encrypted, set the location ID, test the connection, view the last successful sync. |
| FR-ADM-46 | M | Map GHL pipelines and stages to our internal sales stages, so a stage rename in GHL does not break sync. |
| FR-ADM-47 | M | Map GHL custom fields to our fields. |
| FR-ADM-48 | M | White-label settings: company name, logo, favicon, primary and accent colour tokens, document header and email footer. |
| FR-ADM-49 | M | Business settings: timezone, currency display, default deposit percentage, estimate validity period, tax rate and whether tax applies to labour. |
| FR-ADM-50 | M | Lead assignment settings: primary strategy, fallback strategy, SLA timer, per-source overrides. See `06`. |
| FR-ADM-51 | M | Sync monitor: outbox depth, failed items with their error and payload, manual retry, dead-letter view. |
| FR-ADM-52 | S | Webhook log: inbound GHL events, their processing state and any error. |
| FR-ADM-53 | S | Feature flags for gradual rollout of new modules. |

---

## Sales Rep / Estimator

Sees only leads, estimates and jobs where they are the assigned rep. Sees
customer-facing prices. Never sees cost, margin, other reps' data, or
company-wide financials.

| ID | Priority | Requirement |
|---|---|---|
| FR-REP-01 | M | Pipeline board of own leads by sales stage, with card counts and total value per stage. |
| FR-REP-02 | M | Move own leads between stages. Won is reachable only by signature, not by manual drag. |
| FR-REP-03 | M | Lead detail: contact information, source, address, assignment history, appointment history, note timeline, estimate list. |
| FR-REP-04 | M | Add a note to an own lead. The note pushes to the GHL contact as a note. |
| FR-REP-05 | M | Log an activity: call, text, email, site visit, with outcome and duration. |
| FR-REP-06 | M | Build an estimate: select a lead, search and filter the price book, add line items with quantity, across up to three tiers. |
| FR-REP-07 | M | The estimate builder shows customer-facing price only. Cost and margin are absent from the API payload for this role. |
| FR-REP-08 | M | Duplicate a tier as the starting point for another tier, so Better can be built from Good in one action. |
| FR-REP-09 | M | Apply a discount to a tier as either a percentage or a fixed amount, subject to a maximum discount permission; exceeding it requires Admin approval. |
| FR-REP-10 | M | Save an estimate as a draft, edit it, and version it. Sending a revised estimate supersedes the previous one rather than overwriting it. |
| FR-REP-11 | M | Generate the proposal as a GHL document and send it for signature. The lead moves to Estimate Sent. |
| FR-REP-12 | M | See document status as it changes in GHL: sent, viewed, signed, declined. |
| FR-REP-13 | M | On signature, the lead moves to Won, a job is created, and the rep is notified. |
| FR-REP-14 | M | Own appointment list, showing measures and consultations booked for them, with customer, address, time and appointment type. |
| FR-REP-15 | S | Request an appointment reschedule, which writes to the GHL calendar. |
| FR-REP-16 | M | Own commission view: deals won, revenue written, commission accrued, earned, approved and paid, with the per-job breakdown. |
| FR-REP-17 | M | Commission figures for the rep's own deals only. The commission basis and rate are visible; company margin is not, even where commission is margin-based - the rep sees the resulting figure, not the margin input. |
| FR-REP-18 | M | Own won jobs in read-only form: stage, scheduled date, installer name, materials status, payment status, so the rep can answer a customer call without contacting the office. |
| FR-REP-19 | S | Follow-up task list with due dates, driven by stage age and estimate expiry. |
| FR-REP-20 | C | Mobile-optimised on-site estimate building, including room measurement entry with square-footage calculation. |

**Note on FR-REP-17.** If commission is margin-based, the rep can algebraically
infer margin from their own commission amount and rate. This is accepted and
intentional: a rep on a margin-based plan is entitled to understand their own
pay. If the business wants margin genuinely opaque to reps, the commission
basis must be contract revenue. Flag this to the client during configuration.

---

## CSR (Customer Service Representative)

Owns intake and booking. Sees every lead in the early stages regardless of
rep. Sees no money of any kind: no price, no cost, no margin, no commission,
no invoice, no payment.

| ID | Priority | Requirement |
|---|---|---|
| FR-CSR-01 | M | Intake board showing all unassigned and early-stage leads: New, Contacted, Qualified, Appointment Set. |
| FR-CSR-02 | M | Create a lead manually, capturing name, phone, email, address, zip, source and an initial note. The lead is created in GHL as a contact and the returned ID is stored. |
| FR-CSR-03 | M | Leads arriving from GHL (Facebook lead ads, website forms, inbound calls) appear on the intake board automatically within the sync interval. |
| FR-CSR-04 | M | Move a lead through intake stages only: New, Contacted, Qualified, Appointment Set. Stages beyond Qualified are not offered to this role. |
| FR-CSR-05 | M | Log an outreach attempt with outcome: answered, voicemail, no answer, text sent, email sent, wrong number, not interested. |
| FR-CSR-06 | M | Quick actions for the most common outcomes, so logging a voicemail is one click. |
| FR-CSR-07 | M | **Review and assign a lead to a Sales Rep.** This is the primary assignment path and the locked decision D5. The CSR sees rep names, their current open lead count and their territory, and picks one. |
| FR-CSR-08 | M | Reassign a lead to a different rep with a required reason, recorded in `LeadAssignment` history. |
| FR-CSR-09 | M | Book an appointment: select type, date, time and the rep whose calendar it lands on. The appointment is created on the GHL calendar and mirrored locally. |
| FR-CSR-10 | M | Reschedule and cancel appointments, writing through to GHL. |
| FR-CSR-11 | M | See the combined appointment schedule for all reps, to avoid double-booking. |
| FR-CSR-12 | M | See appointments that originated in GHL (booked by the customer through a booking link) without them having been created here. |
| FR-CSR-13 | M | Mark a lead as disqualified with a reason, which moves it to Lost and stops SLA timers. |
| FR-CSR-14 | S | Duplicate detection on lead creation by phone and email, offering to merge instead of creating. |
| FR-CSR-15 | S | SLA dashboard showing leads awaiting assignment, colour-coded by how long they have waited against the configured SLA. |
| FR-CSR-16 | S | Read the GHL conversation thread (SMS and email) for a lead, inline, without leaving the app. |
| FR-CSR-17 | C | Send an SMS or email to the lead through GHL from within the app. |

---

## Installer

Sees only jobs assigned to them or to their crew. Sees no money of any kind.
This role is used on a phone, in a house, frequently with poor signal.

| ID | Priority | Requirement |
|---|---|---|
| FR-INS-01 | M | Today view: jobs scheduled for today, in arrival order, with customer name, address, arrival window and job stage. |
| FR-INS-02 | M | My Jobs view: all open assigned jobs, sorted by scheduled date. |
| FR-INS-03 | M | Completed view: closed jobs, most recent first, retained for the installer's own record. |
| FR-INS-04 | M | Job detail showing scope of work as product names, quantities and units. **No prices.** |
| FR-INS-05 | M | Special instructions and access notes (gate code, pets, parking) entered by the office. |
| FR-INS-06 | M | One-tap navigation to the job address via the device's map application. |
| FR-INS-07 | M | One-tap call to the customer, using a masked number where GHL provides one. |
| FR-INS-08 | M | Sequential status flow: Mark En Route, Mark In Progress, Mark Completed. Only the single next valid action is enabled at any moment. |
| FR-INS-09 | M | Completion is blocked until materials are confirmed received and at least one completion photo is attached. |
| FR-INS-10 | M | Confirm materials received, with an optional note where something is short or damaged. |
| FR-INS-11 | M | Capture and upload job photos from the device camera, tagged Before, Progress, Completion, Issue or Material Delivery. |
| FR-INS-12 | M | Photos are uploaded with EXIF stripped and downsized client-side before transfer, to survive poor connections. |
| FR-INS-13 | M | Report an issue on a job (subfloor damage, wrong material, customer dispute), which notifies the office immediately and flags the job. |
| FR-INS-14 | M | Capture the customer's completion sign-off as a typed acknowledgement of work completed. This is an internal record and is distinct from the contract signature, which lives in GHL. |
| FR-INS-15 | S | Offline tolerance: status changes, notes and photos queue locally when the device is offline and flush automatically on reconnection, with clear queued/synced indicators. |
| FR-INS-16 | S | Job checklist driven by a template per job type, with items ticked off during the install. |
| FR-INS-17 | S | Installable as a PWA with a home-screen icon. |
| FR-INS-18 | C | Time tracking: clock in and clock out per job, for labour cost analysis. |

---

## Public / unauthenticated

| ID | Priority | Requirement |
|---|---|---|
| FR-PUB-01 | M | A webhook endpoint that receives GHL events, verifies the signature, and enqueues them for processing. |
| FR-PUB-02 | M | A health endpoint reporting database connectivity, queue depth and GHL reachability, for uptime monitoring. |
| FR-PUB-03 | S | An inbound lead endpoint for any source that cannot post to GHL directly, which creates the contact in GHL first and then locally. |

**Not present:** there is no public estimate-viewing page and no customer
login. Customers view and sign proposals on GHL's hosted document page, per
locked decision D4.

---

## Future custom roles

FR-ADM-22 allows new roles. The permission registry is designed so that a new
role is a data change, not a code change. Realistic future roles the
permission set already supports:

| Role | Built from | Notable permissions |
|---|---|---|
| Sales Manager | Sales Rep plus team scope | `lead.read.team`, `estimate.approve.discount`, `commission.read.team` |
| Office Manager | CSR plus invoicing | `invoice.*`, `job.schedule`, but not `product.cost.read` |
| Bookkeeper | Read-only financial | `invoice.read`, `payment.read`, `commission.read.all`, `payout.export`, no write |
| Warehouse | Materials only | `job.read.all` limited to scope fields, `material_order.*` |
| Subcontractor Installer | Installer minus history | `job.read.assigned` with retention limited to 30 days |

Each of these is achievable today by composing existing permission keys. If a
future role needs a permission key that does not exist, adding it is a seed
migration plus a guard call at the relevant API route.
