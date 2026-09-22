# 02 · Non-Functional Requirements

IDs are `NFR-<CATEGORY>-<NN>`. Every one of these is testable; if a line here
cannot be verified, it is a wish and should be deleted rather than shipped.

---

## Performance

| ID | Requirement | Target |
|---|---|---|
| NFR-PERF-01 | Server response time for list endpoints under realistic data volume (5,000 leads, 60,000 line items) | p95 < 400 ms, p99 < 900 ms |
| NFR-PERF-02 | Dashboard aggregate queries (revenue, margin, funnel) | p95 < 800 ms |
| NFR-PERF-03 | First Contentful Paint on the installer view over a simulated 3G connection | < 2.0 s |
| NFR-PERF-04 | Largest Contentful Paint, desktop admin dashboard | < 2.5 s |
| NFR-PERF-05 | Estimate builder line-item add/remove, perceived latency | < 100 ms, optimistic UI with rollback on failure |
| NFR-PERF-06 | Job photo upload, 4 MB original over 4G | < 8 s, client-side downscale to max 1920px before transfer |
| NFR-PERF-07 | Every list endpoint is paginated | Default 25, maximum 100 per page. No unbounded `findMany`. |
| NFR-PERF-08 | No N+1 queries in any endpoint | Verified by a Prisma query-count assertion in integration tests |
| NFR-PERF-09 | Database connection pooling | PgBouncer in transaction mode, or Prisma Accelerate. Serverless without pooling will exhaust connections. |

**Load profile assumed.** 12 concurrent internal users at peak, 40 requests
per minute sustained, bursts to 200 rpm. This is a small system by traffic
and a demanding one by correctness. Optimise for correctness.

---

## Availability and reliability

| ID | Requirement | Target |
|---|---|---|
| NFR-REL-01 | Application uptime, business hours (07:00–19:00 local, Mon–Sat) | 99.5% |
| NFR-REL-02 | Planned maintenance window | Sundays 02:00–05:00 local, announced 48 hours ahead |
| NFR-REL-03 | A GHL outage must not take the application down | All GHL calls are queued through the outbox. The UI stays fully usable; affected actions show "queued to sync". |
| NFR-REL-04 | Sync outbox delivery | At-least-once, with idempotency keys making duplicates harmless |
| NFR-REL-05 | Outbox retry policy | Exponential backoff 1s, 5s, 30s, 2m, 10m, 1h, 6h, 24h, then DEAD with an Admin alert |
| NFR-REL-06 | Webhook processing | Idempotent by `externalId`. Replay of the entire last 24 hours must produce no state change. |
| NFR-REL-07 | RPO | 5 minutes |
| NFR-REL-08 | RTO | 4 hours |
| NFR-REL-09 | Restore rehearsal | Quarterly, verified by row counts and a margin reconciliation query |
| NFR-REL-10 | Graceful degradation | If S3 is unreachable, photo upload queues locally and the job flow continues. If Redis is unreachable, the app serves reads and blocks only queue-dependent writes with a clear message. |

---

## Security

| ID | Requirement |
|---|---|
| NFR-SEC-01 | TLS 1.2+ everywhere. HSTS with a minimum age of one year. No plaintext HTTP listener. |
| NFR-SEC-02 | Database encrypted at rest. S3 bucket encrypted, private, no public ACL possible. |
| NFR-SEC-03 | The GHL private integration token is encrypted with AES-256-GCM using a key held outside the database (KMS or an environment secret). It is never logged, never returned by any API, and is redacted by a logger serializer. |
| NFR-SEC-04 | Argon2id password hashing (parameters in doc 04). |
| NFR-SEC-05 | All input validated with Zod at the boundary, `.strict()` so unknown keys are rejected. No request body is ever spread into a Prisma `data` object. |
| NFR-SEC-06 | Parameterised queries only. Any `$queryRawUnsafe` requires a written justification in the PR. |
| NFR-SEC-07 | Content Security Policy with no `unsafe-inline` for scripts. Nonce-based where inline is unavoidable. |
| NFR-SEC-08 | Rate limiting: 5 failed logins per account per 15 minutes; 100 API requests per user per minute; 1,000 webhook deliveries per minute. |
| NFR-SEC-09 | Dependency scanning in CI (`npm audit` plus Dependabot or Renovate). Build fails on a high or critical advisory with a known fix. |
| NFR-SEC-10 | Secrets never committed. Verified by a pre-commit hook and a CI secret scanner. |
| NFR-SEC-11 | Job photos served only through short-lived presigned URLs (15 minutes) issued after a permission check. Object keys are UUIDs and are not guessable. |
| NFR-SEC-12 | Every mutation is audit-logged with actor, IP and user agent (FR-SYS-03). |
| NFR-SEC-13 | Webhook signature verification before any processing. Unverified payloads are recorded and dropped. |
| NFR-SEC-14 | Session cookies `httpOnly`, `secure`, `sameSite=lax`. |
| NFR-SEC-15 | An external penetration test before launch, focused on the permission model: specifically, attempts to read cost, margin and other users' data as each non-Admin role. |

---

## Privacy and compliance

| ID | Requirement |
|---|---|
| NFR-PRIV-01 | Customer PII held: name, phone, email, service address. No payment instruments are ever stored here; card data lives with Stripe via GHL and never touches this database. |
| NFR-PRIV-02 | Because no cardholder data is stored, transmitted or processed by this application, PCI DSS scope is limited to SAQ-A. Do not add a card field later without re-scoping. |
| NFR-PRIV-03 | Customer data deletion on request: soft-delete the lead, redact PII fields in place, retain the financial records with the customer identified only by job number. Deleting a paid invoice is not permitted. |
| NFR-PRIV-04 | Audit logs retained seven years. Webhook logs 90 days. Succeeded outbox rows 30 days. |
| NFR-PRIV-05 | Job photos are business records, retained for the warranty period plus one year, then eligible for deletion. |
| NFR-PRIV-06 | TCPA: SMS consent state lives in GHL and is respected there. This application must not add an independent SMS path that bypasses GHL's consent handling. |

---

## Usability and accessibility

| ID | Requirement |
|---|---|
| NFR-UX-01 | WCAG 2.1 Level AA. Verified by axe-core in CI plus a manual keyboard-only pass on each role's primary flow. |
| NFR-UX-02 | Full keyboard operability. Visible focus indicators. No keyboard trap in any modal. |
| NFR-UX-03 | Text contrast at least 4.5:1, non-text UI at least 3:1, in both light and dark themes. |
| NFR-UX-04 | Touch targets at least 44×44 CSS pixels on the installer view. |
| NFR-UX-05 | Every destructive action has a typed or explicit confirmation. No browser `confirm()`. |
| NFR-UX-06 | Every list has a designed empty state explaining what would put content there. |
| NFR-UX-07 | Every async action shows a loading state within 100 ms and a result toast on completion. |
| NFR-UX-08 | Errors are actionable: what failed, why, what to do. Never a bare stack trace or "Something went wrong". |
| NFR-UX-09 | `prefers-reduced-motion` respected throughout. |
| NFR-UX-10 | The installer view is usable one-handed, in bright daylight, wearing work gloves. This is a real constraint, not a metaphor: large targets, high contrast, minimal typing. |

---

## Compatibility

| ID | Requirement |
|---|---|
| NFR-COMP-01 | Desktop: last two major versions of Chrome, Edge, Firefox and Safari. |
| NFR-COMP-02 | Mobile: iOS Safari 16+, Chrome Android 110+. |
| NFR-COMP-03 | Responsive from 360 px to 2560 px with no horizontal scroll at any width. |
| NFR-COMP-04 | The installer view installs as a PWA with a home-screen icon and a standalone display mode. |
| NFR-COMP-05 | No Internet Explorer support. No polyfills for it. |

---

## Offline behaviour (installer only)

This is the requirement most likely to be dropped for time and most likely to
generate complaints in month two. Installers work in basements and new builds
without signal.

| ID | Requirement |
|---|---|
| NFR-OFF-01 | The installer view loads from a service worker cache when the device is offline, showing the jobs list as of last sync. |
| NFR-OFF-02 | Stage changes, checklist ticks, material confirmations and notes queue locally in IndexedDB when offline. |
| NFR-OFF-03 | Photos captured offline are stored locally and uploaded on reconnection. |
| NFR-OFF-04 | Queued items display an unmistakable "waiting to sync" indicator with a count. |
| NFR-OFF-05 | The queue flushes automatically on reconnection, in the order captured. |
| NFR-OFF-06 | Each queued mutation carries a client-generated idempotency key so a retry cannot double-apply. |
| NFR-OFF-07 | Conflicting server state on flush (the office already advanced the stage) resolves server-side and the device is told what actually happened, rather than silently failing. |
| NFR-OFF-08 | The offline queue survives a browser restart. |

---

## Observability

| ID | Requirement |
|---|---|
| NFR-OBS-01 | Structured JSON logging with a correlation ID threaded through request, job and sync operation. |
| NFR-OBS-02 | Error tracking (Sentry or equivalent) with source maps and user context, PII scrubbed. |
| NFR-OBS-03 | Metrics exposed: request rate and latency by route, outbox depth and age of oldest pending item, webhook processing lag, failed sync count, database pool saturation. |
| NFR-OBS-04 | Alerts: outbox depth > 100 for 10 minutes; any DEAD outbox row; webhook failure rate > 5% over 15 minutes; GHL token verification failure; p95 latency > 2 s for 10 minutes; any unhandled 500. |
| NFR-OBS-05 | An Admin-visible sync health panel showing the same signals in plain language, so the client can tell whether GHL is the problem without calling the developer. |
| NFR-OBS-06 | Uptime monitoring against `/api/health` from an external service, at one-minute intervals. |
| NFR-OBS-07 | A daily reconciliation job comparing invoice totals and payment state against GHL, reporting drift to an Admin. |

---

## Maintainability

| ID | Requirement |
|---|---|
| NFR-MNT-01 | TypeScript `strict: true`. No `any` without an inline justification comment. |
| NFR-MNT-02 | ESLint and Prettier enforced in CI. |
| NFR-MNT-03 | Unit test coverage at least 80% on `lib/` and `services/`. Money, margin, commission and permission resolution require 100% branch coverage. |
| NFR-MNT-04 | Integration tests for every API route covering the happy path, the unauthorised path and one validation failure. |
| NFR-MNT-05 | End-to-end tests (Playwright) for the four role journeys in doc 07, run in CI on every PR. |
| NFR-MNT-06 | **A permission regression test asserting that a Sales Rep, CSR and Installer session receive no cost, margin or commission field on any endpoint.** This test is the guardian of decision D7 and must never be skipped. |
| NFR-MNT-07 | Database migrations are forward-only and reviewed for table locks. |
| NFR-MNT-08 | Every environment variable documented in `.env.example` with its purpose and whether it is required. |
| NFR-MNT-09 | A runbook covering: GHL token rotation, outbox drain, webhook replay, break-glass admin recovery, and restore-from-backup. |

---

## Scalability

| ID | Requirement |
|---|---|
| NFR-SCALE-01 | The application is stateless and horizontally scalable; session state is in the database, not in memory. |
| NFR-SCALE-02 | Background workers scale independently of web servers. |
| NFR-SCALE-03 | Outbox processing is partitioned by `partitionKey` so operations on the same record stay ordered while different records process in parallel. |
| NFR-SCALE-04 | The schema supports 10× the year-one volumes in doc 03 without partitioning. |
| NFR-SCALE-05 | Adding multi-tenancy later requires an additive migration plus a query-scoping extension, not a rewrite. No design choice may foreclose this. |

---

## Operational constraints worth stating plainly

**GHL API rate limits.** GoHighLevel enforces per-location burst and daily
limits on the v2 API. The published figures change; verify them against the
current documentation during the integration spike and encode the real
numbers as configuration, not as constants in code. The outbox must implement
a token-bucket limiter and must back off on HTTP 429 using the `Retry-After`
header. Design assumption: roughly 100 requests per 10 seconds, with a daily
ceiling. Budget the daily volume: every lead stage change, note, appointment
and invoice action is a call.

**Serverless and background work.** The outbox drain and SLA timers need a
persistent process. If the web tier is on Vercel, the worker runs elsewhere.
Do not attempt to run a reliable retry queue on scheduled serverless
invocations.

**Timezone.** All storage in UTC. All display in the company timezone from
`AppSetting`. Installers and customers are in one timezone today; do not
hard-code it.
