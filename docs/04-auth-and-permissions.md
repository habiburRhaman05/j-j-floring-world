# 04 · Authentication, Roles and the Permission Vault

---

## 1 · Model

Three layers, resolved in order:

```
  Layer 1   ROLE PERMISSIONS      union of every permission granted to
                                  every role the user holds
                ↓
  Layer 2   VAULT ALLOW           per-user grants added on top
                ↓
  Layer 3   VAULT DENY            per-user denials removed last
                                  DENY ALWAYS WINS
                ↓
            EFFECTIVE PERMISSION SET
```

Layers 2 and 3 are the permission vault: `UserPermissionOverride`. Every row
carries a `reason`, a `grantedById` and an optional `expiresAt`, because a
temporary elevation that nobody remembers granting is how a permission system
rots. A revoked row keeps `revokedAt` rather than being deleted, so the audit
question "who could approve discounts last March" stays answerable.

---

## 2 · Permission key format

```
<resource>.<action>[.<scope>]
```

- **resource** - the domain noun: `lead`, `estimate`, `product`, `job`, `invoice`, `commission`, `user`, `role`, `setting`, `sync`
- **action** - `read`, `create`, `update`, `delete`, `approve`, `export`, `assign`, `void`
- **scope** - `own`, `team`, `all` for row scope; or a **field name** for field-level keys

Two distinct kinds of key:

**Route-level** keys gate whether a request is allowed at all.
`estimate.create`, `job.update.all`, `user.suspend`.

**Field-level** keys (`Permission.isFieldLevel = true`) gate whether a field
appears in a response. `product.cost.read`, `financials.margin.read`,
`commission.amount.read.own`. These are checked inside the response
serializer, which is what makes decision D7 real: a Sales Rep calling
`GET /api/products` receives objects with **no `costPerUnit` key present**,
not a null and not a zero.

---

## 3 · Permission registry

The seeded list. Adding a key later is a seed migration plus a guard call.

### Leads
| Key | Notes |
|---|---|
| `lead.read.own` | Assigned to me |
| `lead.read.team` | Assigned to anyone in my team, for a future Sales Manager |
| `lead.read.all` | Everything |
| `lead.read.intake` | Only leads in NEW/CONTACTED/QUALIFIED/APPOINTMENT_SET, regardless of assignment. This is the CSR's key. |
| `lead.create` | |
| `lead.update.own` / `lead.update.all` | |
| `lead.stage.update.intake` | Move within intake stages only. CSR. |
| `lead.stage.update.all` | Any stage transition |
| `lead.assign` | **The CSR's core permission, decision D5** |
| `lead.reassign` | Move an already-assigned lead |
| `lead.disqualify` | |
| `lead.note.create` / `lead.note.read.internal` | Internal notes are hidden from roles without the second key |
| `lead.export` | |

### Products and pricing
| Key | Notes |
|---|---|
| `product.read` | Name, category, unit, **price**. Not cost. |
| `product.cost.read` | **Field-level.** Admin only by default. |
| `product.create` / `product.update` / `product.deactivate` | |
| `product.price.update` | Separable from general edit, so a Sales Manager could fix a typo in a name without touching pricing |
| `product.import` / `product.export` | |

### Estimates
| Key | Notes |
|---|---|
| `estimate.read.own` / `estimate.read.all` | |
| `estimate.create` / `estimate.update.own` / `estimate.update.all` | |
| `estimate.send` | Generates and sends the GHL document |
| `estimate.discount.apply` | With a `maxPercent` constraint in the vault row |
| `estimate.discount.approve` | Approve someone else's over-limit discount |
| `estimate.void` | |

### Jobs
| Key | Notes |
|---|---|
| `job.read.assigned` | Installer: mine or my crew's |
| `job.read.own` | Sales Rep: jobs from my sold estimates, read-only |
| `job.read.all` | |
| `job.stage.update.assigned` | Installer's sequential flow |
| `job.stage.update.all` | Admin override to any stage |
| `job.schedule` | Assign installer and date |
| `job.materials.update` | |
| `job.photo.create` / `job.photo.delete` | |
| `job.issue.create` / `job.issue.resolve` | |
| `job.confirm` | Office completion confirmation; gates commission earning |
| `job.cancel` | |

### Money
| Key | Notes |
|---|---|
| `invoice.read.own` | Rep: payment status on my jobs, amounts only |
| `invoice.read.all` | |
| `invoice.create` / `invoice.send` / `invoice.void` | |
| `payment.record.offline` | Record a cash or check payment |
| `payment.read` | |
| `financials.margin.read` | **Field-level.** Gates margin on every payload. |
| `financials.company.read` | Company-wide revenue, cost and margin dashboards |
| `financials.export` | |

### Commission
| Key | Notes |
|---|---|
| `commission.read.own` | |
| `commission.read.all` | |
| `commission.rule.manage` | |
| `commission.approve` | Move ledger entries to APPROVED |
| `payout.create` / `payout.approve` / `payout.export` | |

### Appointments
| Key | Notes |
|---|---|
| `appointment.read.own` / `appointment.read.all` | |
| `appointment.create` / `appointment.update` / `appointment.cancel` | |

### Administration
| Key | Notes |
|---|---|
| `user.read` / `user.invite` / `user.update` / `user.suspend` | |
| `role.read` / `role.create` / `role.update` / `role.delete` | |
| `permission.grant` / `permission.revoke` | **Grants access to the vault itself. Admin only, always.** |
| `setting.read` / `setting.update` | |
| `setting.integration.manage` | GHL token and location |
| `sync.read` | Sync monitor |
| `sync.retry` / `sync.resolve_conflict` | |
| `audit.read` | |

---

## 4 · Default role grants

| Permission group | Admin | Sales Rep | CSR | Installer |
|---|:--:|:--:|:--:|:--:|
| `lead.read.all` | ● | | | |
| `lead.read.own` | ● | ● | | |
| `lead.read.intake` | ● | | ● | |
| `lead.assign` / `lead.reassign` | ● | | ● | |
| `lead.stage.update.intake` | ● | | ● | |
| `lead.stage.update.all` | ● | ● | | |
| `product.read` | ● | ● | | |
| **`product.cost.read`** | **●** | | | |
| `product.*` manage | ● | | | |
| `estimate.read.own` / `create` / `send` | ● | ● | | |
| `estimate.discount.approve` | ● | | | |
| `job.read.all` | ● | | | |
| `job.read.own` | ● | ● | | |
| `job.read.assigned` | ● | | | ● |
| `job.stage.update.assigned` | ● | | | ● |
| `job.schedule` / `job.confirm` | ● | | | |
| `job.photo.create` | ● | | | ● |
| `job.issue.create` | ● | | | ● |
| `invoice.read.all` / `create` / `send` | ● | | | |
| `invoice.read.own` | ● | ● | | |
| **`financials.margin.read`** | **●** | | | |
| `financials.company.read` | ● | | | |
| `commission.read.own` | ● | ● | | |
| `commission.read.all` / `approve` / `payout.*` | ● | | | |
| `appointment.read.own` | ● | ● | | ● |
| `appointment.read.all` / `create` / `update` | ● | | ● | |
| `user.*` / `role.*` / `permission.*` | ● | | | |
| `setting.*` / `sync.*` / `audit.read` | ● | | | |

Read the blank cells carefully: **the CSR row has no money permission of any
kind**, and neither does the Installer row. That is the enforcement behind
FR-CSR and FR-INS.

---

## 5 · Resolution algorithm

```ts
async function effectivePermissions(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      roles: { include: { role: { include: {
        permissions: { include: { permission: true } } } } } },
      permissionOverrides: {
        where: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: { permission: true },
      },
    },
  })

  if (user.status !== 'ACTIVE') return new Set()

  // Layer 1 - union of role grants
  const keys = new Set<string>()
  for (const ur of user.roles)
    for (const rp of ur.role.permissions)
      keys.add(rp.permission.key)

  // Layer 2 - vault ALLOW
  for (const o of user.permissionOverrides)
    if (o.effect === 'ALLOW') keys.add(o.permission.key)

  // Layer 3 - vault DENY, last and unconditional
  for (const o of user.permissionOverrides)
    if (o.effect === 'DENY') keys.delete(o.permission.key)

  return keys
}
```

**Caching.** Resolve once per request, attach to the request context. Cache
in Redis keyed `perm:{userId}:{version}` where the version is bumped by any
write to `UserRole`, `RolePermission` or `UserPermissionOverride`. Never cache
longer than the session. A revoked permission must take effect on the next
request, not in fifteen minutes.

**Constraints.** A vault row may carry `constraints`, e.g.
`{"maxDiscountPercent": 15}` on `estimate.discount.apply`. The guard returns
the merged constraint object and the handler enforces it. Where two rows
supply the same constraint, the **more restrictive** value wins.

---

## 6 · Enforcement points

Four layers. All four are required; any one alone is insufficient.

**1 · Route guard.** Every mutation and every non-public read.

```ts
export const POST = withAuth(
  { require: 'estimate.create' },
  async (req, ctx) => { /* ctx.user, ctx.permissions, ctx.constraints */ }
)
```

**2 · Row scoping.** Resolved from the scope suffix into a Prisma `where`.

```ts
function leadScope(ctx: Ctx): Prisma.LeadWhereInput {
  if (ctx.can('lead.read.all'))    return {}
  if (ctx.can('lead.read.intake')) return { stage: { in: INTAKE_STAGES } }
  if (ctx.can('lead.read.own'))    return { assignedRepId: ctx.user.id }
  throw new ForbiddenError()
}
```

Never `findMany()` then filter in JavaScript. The scope goes into the query.

**3 · Field serialization.** This is decision D7.

```ts
export function serializeProduct(p: Product, ctx: Ctx) {
  const out: Record<string, unknown> = {
    id: p.id, name: p.name, category: p.categoryId,
    unit: p.unit, pricePerUnit: p.pricePerUnit, active: p.active,
  }
  if (ctx.can('product.cost.read')) {
    out.costPerUnit = p.costPerUnit
    out.margin = new Decimal(p.pricePerUnit).minus(p.costPerUnit)
  }
  return out   // no cost key at all for a rep, not a null
}
```

**4 · UI.** Hides controls the user cannot use. This is courtesy, never
security. The UI never receives data the API withheld, so a devtools
inspection of a rep session finds nothing.

---

## 7 · Sessions and login

| Aspect | Choice | Why |
|---|---|---|
| Strategy | Auth.js **database** sessions | A suspended user loses access on their next request. A JWT would stay valid until expiry. |
| Idle timeout | 12 hours rolling | Long enough for a workday |
| Absolute timeout | 30 days | |
| Password hashing | Argon2id, memory 64 MB, iterations 3, parallelism 4 | Prefer over bcrypt for new systems |
| Password policy | Minimum 12 characters, checked against the HaveIBeenPwned k-anonymity range API | Length and breach-checking beat composition rules |
| Rate limiting | 5 failed attempts per account per 15 minutes, 20 per IP per 15 minutes | Lockout is per-account, with email notification |
| 2FA | TOTP, optional for all, **mandatory for Admin** | Enforced at login, not at grant time, so an existing user promoted to Admin is prompted on next login |
| Role switching | `Session.activeRoleId` | A multi-role user acts as one role at a time; switching is audited |
| Invitation | Single-use token, 7-day expiry, hashed at rest | |
| Password reset | Single-use token, 30-minute expiry, hashed at rest, invalidates all sessions on use | |

**Impersonation.** Not in v1. If support needs it later it must write an
`AuditLog` row on entry and exit, display a persistent banner, and be gated
behind a dedicated `user.impersonate` permission that no role holds by
default and that can only be vault-granted with an expiry.

---

## 8 · Protecting against lockout

`Role.isSystem` prevents deleting the four built-ins, but the real risk is an
Admin removing `permission.grant` from the Admin role and stranding everyone.

Three guards:

1. The Admin role's grants of `role.update`, `permission.grant` and `user.update` cannot be removed. Enforced in the service layer with a named check, not a database constraint, so the error message can explain itself.
2. The last `ACTIVE` user holding the Admin role cannot be suspended or have the Admin role revoked.
3. A break-glass CLI command, runnable only with database credentials, that restores the Admin role's default grants and creates a recovery admin. Documented in the runbook, not in the application.

---

## 9 · Threat notes

| Risk | Mitigation |
|---|---|
| Rep enumerates other reps' leads by ID | Row scoping in the `where` clause. A direct-ID fetch outside scope returns 404, not 403, so IDs cannot be probed for existence. |
| Rep reads cost from the API | Field serialization. The key is absent. |
| Stale permission after revocation | Cache keyed on a version bumped by any grant change. |
| Session fixation | Auth.js rotates the session token on login. |
| CSRF | SameSite=Lax cookies plus Auth.js CSRF tokens on mutations. |
| Mass assignment | Zod schemas with `.strict()` on every input. Never spread a request body into a Prisma `data` object. |
| Webhook spoofing | Signature verification before any processing; invalid signatures are logged with `signatureValid = false` and dropped. |
| Token leakage in logs | The GHL token lives encrypted in `IntegrationCredential`, is never placed in an environment variable that is logged, and is redacted by a logger serializer. |
| Photo URL guessing | S3 objects are private; access is via short-lived presigned URLs generated per request after a permission check. |
