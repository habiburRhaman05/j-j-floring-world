# 08 · API Surface

Next.js App Router. Route handlers under `app/api/**/route.ts` for anything
consumed as an API; Server Actions for form mutations inside the app. Both go
through the same service layer, the same Zod validation and the same
permission guard. There is no second path to the database.

**Every route below lists the permission it requires.** A route with no
permission listed is a bug.

---

## Conventions

| Aspect | Rule |
|---|---|
| Base path | `/api/v1` |
| Auth | Session cookie. No API keys in v1. |
| Validation | Zod, `.strict()`, at the boundary |
| Errors | `{ error: { code, message, details? } }` with a correlation ID header |
| Status codes | 400 validation, 401 unauthenticated, 403 unauthorised, 404 not found **or out of scope**, 409 conflict, 422 business-rule violation, 429 rate limited |
| Pagination | `?page=&pageSize=` (default 25, max 100), returns `{ data, meta: { page, pageSize, total, totalPages } }` |
| Filtering | Explicit query params, never a raw filter object from the client |
| Idempotency | `Idempotency-Key` header accepted on all POSTs that create money or GHL records |

**On 404 vs 403.** A record outside the caller's row scope returns **404**,
not 403. Returning 403 confirms the record exists and lets a rep enumerate
other reps' lead IDs.

---

## Auth

| Method | Path | Permission |
|---|---|---|
| POST | `/auth/login` | public, rate limited |
| POST | `/auth/logout` | authenticated |
| POST | `/auth/forgot-password` | public, rate limited |
| POST | `/auth/reset-password` | public, valid token |
| POST | `/auth/accept-invitation` | public, valid token |
| GET | `/auth/session` | authenticated |
| POST | `/auth/switch-role` | authenticated, multi-role |
| POST | `/auth/2fa/enroll` · `/verify` · `/disable` | authenticated |

---

## Leads

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/leads` | `lead.read.*` | Scope resolved from the permission suffix. Filters: `stage`, `assignedRepId`, `source`, `postalCode`, `unassigned`, `q` |
| POST | `/leads` | `lead.create` | Creates in GHL first, then locally |
| GET | `/leads/:id` | `lead.read.*` | 404 if out of scope |
| PATCH | `/leads/:id` | `lead.update.*` | Rejects any GHL-owned field with 422 and names the field |
| POST | `/leads/:id/stage` | `lead.stage.update.intake` or `.all` | CSR limited to intake stages |
| POST | `/leads/:id/assign` | `lead.assign` | Body: `{ userId, reason? }`. Cancels the SLA task. |
| POST | `/leads/:id/reassign` | `lead.reassign` | `reason` required |
| POST | `/leads/:id/disqualify` | `lead.disqualify` | Body: `{ lostReason, note? }` |
| GET | `/leads/:id/assignment-suggestion` | `lead.assign` | Runs the configured strategy read-only, returns the candidate table for the CSR screen |
| POST | `/leads/:id/notes` | `lead.note.create` | `isInternal` requires `lead.note.read.internal` |
| GET | `/leads/:id/activities` | `lead.read.*` | |
| POST | `/leads/:id/activities` | `lead.update.*` | Call, text, visit with outcome |
| GET | `/leads/:id/conversation` | `lead.read.*` | Proxies the GHL conversation thread, cached 60 s |
| POST | `/leads/merge` | `lead.update.all` | `{ keepId, mergeId }` |
| GET | `/leads/export` | `lead.export` | CSV, scope applied |

---

## Products

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/products` | `product.read` | **`costPerUnit` and `margin` present only with `product.cost.read`** |
| POST | `/products` | `product.create` | |
| GET | `/products/:id` | `product.read` | |
| PATCH | `/products/:id` | `product.update` / `product.price.update` | Price changes write `ProductPriceHistory` |
| POST | `/products/:id/deactivate` | `product.deactivate` | Soft, never a delete |
| POST | `/products/bulk-price` | `product.price.update` | `{ filter, adjustment, dryRun }`. `dryRun: true` returns the margin preview and writes nothing. |
| POST | `/products/import` | `product.import` | Multipart CSV, `dryRun` supported, returns row-level errors |
| GET | `/products/export` | `product.export` | Cost column included only with `product.cost.read` |
| GET/POST/PATCH | `/product-categories` | `product.*` | |

---

## Estimates

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/estimates` | `estimate.read.*` | |
| POST | `/estimates` | `estimate.create` | |
| GET | `/estimates/:id` | `estimate.read.*` | Cost fields on line items omitted without `product.cost.read` |
| PATCH | `/estimates/:id` | `estimate.update.*` | DRAFT only; a sent estimate is revised, not edited |
| POST | `/estimates/:id/tiers/:level/items` | `estimate.update.*` | Snapshots cost and price at insert |
| PATCH | `/estimates/:id/items/:itemId` | `estimate.update.*` | Quantity only. Unit cost and price are immutable. |
| DELETE | `/estimates/:id/items/:itemId` | `estimate.update.*` | |
| POST | `/estimates/:id/tiers/:level/duplicate` | `estimate.update.*` | Copies a tier into another tier |
| POST | `/estimates/:id/discount` | `estimate.discount.apply` | Enforces the vault `maxDiscountPercent` constraint |
| POST | `/estimates/:id/discount/approve` | `estimate.discount.approve` | |
| POST | `/estimates/:id/send` | `estimate.send` | Creates and sends the GHL document, queues the outbox row |
| POST | `/estimates/:id/revise` | `estimate.create` | New version, supersedes the old one |
| POST | `/estimates/:id/void` | `estimate.void` | |
| GET | `/estimates/:id/preview` | `estimate.read.*` | Customer-facing render, prices only, always |

---

## Jobs

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/jobs` | `job.read.*` | Installer scope covers own plus crew |
| GET | `/jobs/today` | `job.read.assigned` | The installer Today view |
| GET | `/jobs/:id` | `job.read.*` | **Financial fields omitted entirely without `financials.margin.read`** |
| POST | `/jobs/:id/stage` | `job.stage.update.assigned` / `.all` | Installer restricted to the sequential flow; Admin may set any stage |
| POST | `/jobs/:id/schedule` | `job.schedule` | `{ installerId?, crewId?, scheduledDate, arrivalWindow }` |
| POST | `/jobs/:id/materials` | `job.materials.update` | |
| POST | `/jobs/:id/photos` | `job.photo.create` | Presigned S3 upload, then a metadata POST |
| GET | `/jobs/:id/photos` | `job.read.*` | Returns short-lived presigned URLs |
| POST | `/jobs/:id/issues` | `job.issue.create` | Notifies Admin by severity |
| POST | `/jobs/:id/issues/:issueId/resolve` | `job.issue.resolve` | |
| POST | `/jobs/:id/checklist/:itemId` | `job.stage.update.assigned` | |
| POST | `/jobs/:id/signoff` | `job.stage.update.assigned` | Internal completion acknowledgement |
| POST | `/jobs/:id/confirm` | `job.confirm` | Sets `adminConfirmedAt`, re-evaluates commission earning |
| POST | `/jobs/:id/cancel` | `job.cancel` | Voids the balance, claws back commission |
| POST | `/jobs/:id/change-order` | `job.update.all` | Creates a supplementary invoice and adjusts commission |
| POST | `/jobs/sync` | `job.stage.update.assigned` | **Offline queue flush.** Array of mutations, each with a client idempotency key. Returns per-item applied/conflict/rejected. |

---

## Invoices and payments

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/invoices` | `invoice.read.*` | |
| GET | `/invoices/:id` | `invoice.read.*` | `snapshotCost` and margin omitted without `financials.margin.read` |
| POST | `/invoices` | `invoice.create` | Builds in GHL from a signed estimate |
| POST | `/invoices/:id/send` | `invoice.send` | |
| POST | `/invoices/:id/void` | `invoice.void` | |
| POST | `/invoices/:id/resync` | `sync.retry` | Pulls current state from GHL on demand |
| GET | `/invoices/:id/payments` | `payment.read` | |
| POST | `/invoices/:id/payments/offline` | `payment.record.offline` | Records locally, pushes to GHL |

---

## Commission and payouts

| Method | Path | Permission |
|---|---|---|
| GET | `/commissions` | `commission.read.own` / `.all` |
| GET | `/commissions/summary` | `commission.read.own` / `.all` |
| POST | `/commissions/:id/approve` | `commission.approve` |
| POST | `/commissions/:id/clawback` | `commission.approve` |
| GET/POST/PATCH | `/commission-rules` | `commission.rule.manage` |
| POST | `/commission-rules/preview` | `commission.rule.manage` |
| GET/POST | `/payouts` | `payout.create` |
| POST | `/payouts/:id/approve` | `payout.approve` |
| POST | `/payouts/:id/pay` | `payout.approve` |
| GET | `/payouts/:id/export` | `payout.export` |

**`/commission-rules/preview`** is worth building early. It takes a proposed
rule and replays it against the last 90 days of closed jobs, returning what
would have been paid. It turns a commission-plan argument into a number.

---

## Appointments

| Method | Path | Permission |
|---|---|---|
| GET | `/appointments` | `appointment.read.own` / `.all` |
| GET | `/appointments/availability` | `appointment.create` |
| POST | `/appointments` | `appointment.create` |
| PATCH | `/appointments/:id` | `appointment.update` |
| POST | `/appointments/:id/cancel` | `appointment.cancel` |

All four mutations write to GHL first. GHL's response is the truth.

---

## Dashboards

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/dashboard/company` | `financials.company.read` | Revenue, cost, margin, collected, outstanding |
| GET | `/dashboard/funnel` | `lead.read.all` | |
| GET | `/dashboard/job-pipeline` | `job.read.all` | |
| GET | `/dashboard/leaderboard` | `commission.read.all` | |
| GET | `/dashboard/my-pipeline` | `lead.read.own` | Rep's own counts |
| GET | `/dashboard/my-commission` | `commission.read.own` | |
| GET | `/dashboard/intake` | `lead.read.intake` | CSR counts and SLA status |

Dashboard endpoints are **separate from list endpoints on purpose**. They run
aggregate SQL and return numbers, rather than fetching rows and summing them
in JavaScript.

---

## Administration

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/users` | `user.read` / `user.invite` |
| PATCH | `/users/:id` | `user.update` |
| POST | `/users/:id/suspend` · `/reactivate` | `user.suspend` |
| GET/POST/PATCH/DELETE | `/roles` | `role.*` |
| GET | `/permissions` | `role.read` |
| POST | `/users/:id/permissions` | `permission.grant` |
| DELETE | `/users/:id/permissions/:permissionId` | `permission.revoke` |
| GET | `/users/:id/effective-permissions` | `role.read` |
| GET/PATCH | `/settings` | `setting.read` / `setting.update` |
| GET/PATCH | `/settings/branding` | `setting.update` |
| POST | `/settings/integration/ghl/test` | `setting.integration.manage` |
| GET/POST | `/settings/ghl/pipeline-mappings` | `setting.integration.manage` |
| GET/POST/PATCH | `/assignment-rules` · `/territories` | `setting.update` |
| GET | `/audit-logs` | `audit.read` |

---

## Sync operations

| Method | Path | Permission |
|---|---|---|
| GET | `/sync/status` | `sync.read` |
| GET | `/sync/outbox` | `sync.read` |
| POST | `/sync/outbox/:id/retry` | `sync.retry` |
| GET | `/sync/webhooks` | `sync.read` |
| POST | `/sync/webhooks/:id/reprocess` | `sync.retry` |
| GET | `/sync/conflicts` | `sync.read` |
| POST | `/sync/conflicts/:id/resolve` | `sync.resolve_conflict` |
| POST | `/sync/reconcile` | `sync.retry` |

---

## Public

| Method | Path | Auth |
|---|---|---|
| POST | `/webhooks/ghl` | Signature verification. Returns 200 within 500 ms, always. |
| GET | `/health` | None. Database, queue depth, GHL reachability. |
| POST | `/public/leads` | Shared secret, rate limited. Creates in GHL first. |

---

## Serialization contract

One function per entity, taking the request context. This is where decision
D7 is implemented and it is the file to read in a code review.

```ts
export function serializeJob(job: JobWithRelations, ctx: Ctx) {
  const base = {
    id: job.id, number: job.number, stage: job.stage,
    scheduledDate: job.scheduledDate,
    customer: { name: fullName(job.lead), phone: job.lead.phone },
    siteAddress: job.siteAddressLine1,
    accessNotes: job.accessNotes,
    materialsReceived: job.materialsReceived,
    scope: job.invoices[0]?.lineItems.map(li => ({
      name: li.name, quantity: li.quantity, unit: li.unit,
      // no unitPrice, no unitCost - the installer never receives them
    })) ?? [],
  }

  if (ctx.can('financials.margin.read')) {
    const inv = job.invoices[0]
    return { ...base, financials: {
      contractPrice: inv?.total,
      cost: inv?.snapshotCost,
      margin: inv ? new Decimal(inv.total).minus(inv.snapshotCost) : null,
    }}
  }
  if (ctx.can('invoice.read.own')) {
    return { ...base, payment: { status: job.invoices[0]?.status } }
  }
  return base
}
```

Three shapes from one function, decided by permission, with the restricted
shapes containing no trace of what was withheld.

**NFR-MNT-06 tests exactly this**: for each non-Admin role, walk every
endpoint and assert that no response body anywhere contains the keys `cost`,
`unitCost`, `snapshotCost`, `margin` or `commission`. That test is the
guardian of the whole permission model.
