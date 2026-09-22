/* ==========================================================================
   seed.ts  -  baseline reference data (doc 03 §6, doc 04 §3-4)
   --------------------------------------------------------------------------
   `npm run db:seed`. Idempotent throughout (upserts), so it is safe to run
   again against an existing database. Demo/sample business data (leads, jobs,
   products) is a separate file and never runs here - this seeds only what
   the system depends on to boot: roles, the permission registry, default
   role grants, the first admin, and one branding profile.
   ========================================================================== */

import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const SYSTEM_ROLES = [
  { key: "admin", name: "Administrator", description: "Full access to every module and setting.", isSystem: true, defaultScope: "all", sortOrder: 10 },
  { key: "csr", name: "CSR", description: "Intake, lead assignment and appointment booking.", isSystem: true, defaultScope: "team", sortOrder: 20 },
  { key: "sales_rep", name: "Sales Representative", description: "Own leads, estimates and commissions.", isSystem: true, defaultScope: "own", sortOrder: 30 },
  { key: "installer", name: "Installer", description: "Assigned jobs, schedules, photos and issues.", isSystem: true, defaultScope: "own", sortOrder: 40 },
] as const;

/** The permission registry, doc 04 §3. Adding a key later is a seed migration plus a guard call. */
const PERMISSIONS: { key: string; resource: string; action: string; scope?: string; description: string; isFieldLevel?: boolean; category: string }[] = [
  // Leads
  { key: "lead.read.own", resource: "lead", action: "read", scope: "own", description: "Leads assigned to me.", category: "leads" },
  { key: "lead.read.team", resource: "lead", action: "read", scope: "team", description: "Leads assigned to anyone in my team.", category: "leads" },
  { key: "lead.read.all", resource: "lead", action: "read", scope: "all", description: "Every lead.", category: "leads" },
  { key: "lead.read.intake", resource: "lead", action: "read", scope: "intake", description: "Leads in NEW/CONTACTED/QUALIFIED/APPOINTMENT_SET regardless of assignment.", category: "leads" },
  { key: "lead.create", resource: "lead", action: "create", description: "Create a lead.", category: "leads" },
  { key: "lead.update.own", resource: "lead", action: "update", scope: "own", description: "Edit my own leads.", category: "leads" },
  { key: "lead.update.all", resource: "lead", action: "update", scope: "all", description: "Edit any lead.", category: "leads" },
  { key: "lead.stage.update.intake", resource: "lead", action: "update", scope: "intake", description: "Move a lead within intake stages only.", category: "leads" },
  { key: "lead.stage.update.all", resource: "lead", action: "update", scope: "all", description: "Move a lead to any stage.", category: "leads" },
  { key: "lead.assign", resource: "lead", action: "assign", description: "Assign a lead to a Sales Rep.", category: "leads" },
  { key: "lead.reassign", resource: "lead", action: "assign", scope: "reassign", description: "Reassign an already-assigned lead.", category: "leads" },
  { key: "lead.disqualify", resource: "lead", action: "update", scope: "disqualify", description: "Mark a lead disqualified.", category: "leads" },
  { key: "lead.note.create", resource: "lead", action: "create", scope: "note", description: "Add a note to a lead.", category: "leads" },
  { key: "lead.note.read.internal", resource: "lead", action: "read", scope: "note_internal", description: "See internal notes.", category: "leads" },
  { key: "lead.export", resource: "lead", action: "export", description: "Export leads to CSV.", category: "leads" },

  // Products
  { key: "product.read", resource: "product", action: "read", description: "Name, category, unit, price. Not cost.", category: "products" },
  { key: "product.cost.read", resource: "product", action: "read", scope: "cost", description: "See costPerUnit and margin.", isFieldLevel: true, category: "products" },
  { key: "product.create", resource: "product", action: "create", description: "Create a product.", category: "products" },
  { key: "product.update", resource: "product", action: "update", description: "Edit a product.", category: "products" },
  { key: "product.deactivate", resource: "product", action: "delete", description: "Deactivate a product (soft).", category: "products" },
  { key: "product.price.update", resource: "product", action: "update", scope: "price", description: "Change cost/price, separable from a general edit.", category: "products" },
  { key: "product.import", resource: "product", action: "create", scope: "import", description: "Bulk import the price book.", category: "products" },
  { key: "product.export", resource: "product", action: "export", description: "Export the price book.", category: "products" },

  // Estimates
  { key: "estimate.read.own", resource: "estimate", action: "read", scope: "own", description: "My own estimates.", category: "estimates" },
  { key: "estimate.read.all", resource: "estimate", action: "read", scope: "all", description: "Every estimate.", category: "estimates" },
  { key: "estimate.create", resource: "estimate", action: "create", description: "Create an estimate.", category: "estimates" },
  { key: "estimate.update.own", resource: "estimate", action: "update", scope: "own", description: "Edit my own draft estimates.", category: "estimates" },
  { key: "estimate.update.all", resource: "estimate", action: "update", scope: "all", description: "Edit any estimate.", category: "estimates" },
  { key: "estimate.send", resource: "estimate", action: "update", scope: "send", description: "Generate and send the GHL document.", category: "estimates" },
  { key: "estimate.discount.apply", resource: "estimate", action: "update", scope: "discount", description: "Apply a discount within the vault-granted limit.", category: "estimates" },
  { key: "estimate.discount.approve", resource: "estimate", action: "approve", scope: "discount", description: "Approve an over-limit discount.", category: "estimates" },
  { key: "estimate.void", resource: "estimate", action: "delete", description: "Void an estimate.", category: "estimates" },

  // Jobs
  { key: "job.read.assigned", resource: "job", action: "read", scope: "assigned", description: "Installer: mine or my crew's jobs.", category: "jobs" },
  { key: "job.read.own", resource: "job", action: "read", scope: "own", description: "Sales Rep: jobs from my sold estimates, read-only.", category: "jobs" },
  { key: "job.read.all", resource: "job", action: "read", scope: "all", description: "Every job.", category: "jobs" },
  { key: "job.stage.update.assigned", resource: "job", action: "update", scope: "assigned", description: "Installer's sequential stage flow.", category: "jobs" },
  { key: "job.stage.update.all", resource: "job", action: "update", scope: "all", description: "Admin override to any stage.", category: "jobs" },
  { key: "job.schedule", resource: "job", action: "update", scope: "schedule", description: "Assign installer/crew and date.", category: "jobs" },
  { key: "job.materials.update", resource: "job", action: "update", scope: "materials", description: "Record material order status.", category: "jobs" },
  { key: "job.photo.create", resource: "job", action: "create", scope: "photo", description: "Upload a job photo.", category: "jobs" },
  { key: "job.photo.delete", resource: "job", action: "delete", scope: "photo", description: "Delete a job photo.", category: "jobs" },
  { key: "job.issue.create", resource: "job", action: "create", scope: "issue", description: "Report a job issue.", category: "jobs" },
  { key: "job.issue.resolve", resource: "job", action: "update", scope: "issue", description: "Resolve a job issue.", category: "jobs" },
  { key: "job.confirm", resource: "job", action: "approve", description: "Office completion confirmation; gates commission earning.", category: "jobs" },
  { key: "job.cancel", resource: "job", action: "delete", description: "Cancel a job.", category: "jobs" },

  // Money
  { key: "invoice.read.own", resource: "invoice", action: "read", scope: "own", description: "Rep: payment status on my jobs, amounts only.", category: "money" },
  { key: "invoice.read.all", resource: "invoice", action: "read", scope: "all", description: "Every invoice.", category: "money" },
  { key: "invoice.create", resource: "invoice", action: "create", description: "Create an invoice in GHL from a signed estimate.", category: "money" },
  { key: "invoice.send", resource: "invoice", action: "update", scope: "send", description: "Send an invoice.", category: "money" },
  { key: "invoice.void", resource: "invoice", action: "delete", description: "Void an invoice.", category: "money" },
  { key: "payment.record.offline", resource: "payment", action: "create", scope: "offline", description: "Record a cash or check payment.", category: "money" },
  { key: "payment.read", resource: "payment", action: "read", description: "Read payment records.", category: "money" },
  { key: "financials.margin.read", resource: "financials", action: "read", scope: "margin", description: "Gates margin on every payload.", isFieldLevel: true, category: "money" },
  { key: "financials.company.read", resource: "financials", action: "read", scope: "company", description: "Company-wide revenue, cost and margin dashboards.", category: "money" },
  { key: "financials.export", resource: "financials", action: "export", description: "Export financial reports.", category: "money" },

  // Commission
  { key: "commission.read.own", resource: "commission", action: "read", scope: "own", description: "My own commission ledger.", category: "commission" },
  { key: "commission.read.all", resource: "commission", action: "read", scope: "all", description: "Every commission ledger entry.", category: "commission" },
  { key: "commission.rule.manage", resource: "commission", action: "update", scope: "rule", description: "Define commission rules.", category: "commission" },
  { key: "commission.approve", resource: "commission", action: "approve", description: "Move a ledger entry to APPROVED.", category: "commission" },
  { key: "payout.create", resource: "payout", action: "create", description: "Create a payout batch.", category: "commission" },
  { key: "payout.approve", resource: "payout", action: "approve", description: "Approve and mark a payout paid.", category: "commission" },
  { key: "payout.export", resource: "payout", action: "export", description: "Export a payout batch as CSV.", category: "commission" },

  // Appointments
  { key: "appointment.read.own", resource: "appointment", action: "read", scope: "own", description: "My own appointments.", category: "appointments" },
  { key: "appointment.read.all", resource: "appointment", action: "read", scope: "all", description: "Every appointment.", category: "appointments" },
  { key: "appointment.create", resource: "appointment", action: "create", description: "Book an appointment.", category: "appointments" },
  { key: "appointment.update", resource: "appointment", action: "update", description: "Reschedule an appointment.", category: "appointments" },
  { key: "appointment.cancel", resource: "appointment", action: "delete", description: "Cancel an appointment.", category: "appointments" },

  // Administration
  { key: "user.read", resource: "user", action: "read", description: "List and view users.", category: "administration" },
  { key: "user.invite", resource: "user", action: "create", description: "Invite a user by email.", category: "administration" },
  { key: "user.update", resource: "user", action: "update", description: "Edit a user.", category: "administration" },
  { key: "user.suspend", resource: "user", action: "update", scope: "suspend", description: "Suspend or reactivate a user.", category: "administration" },
  { key: "role.read", resource: "role", action: "read", description: "View roles and the permission matrix.", category: "administration" },
  { key: "role.create", resource: "role", action: "create", description: "Create a custom role.", category: "administration" },
  { key: "role.update", resource: "role", action: "update", description: "Edit a role's permissions.", category: "administration" },
  { key: "role.delete", resource: "role", action: "delete", description: "Delete a custom role.", category: "administration" },
  { key: "permission.grant", resource: "permission", action: "approve", scope: "grant", description: "Grant a vault override to a user.", category: "administration" },
  { key: "permission.revoke", resource: "permission", action: "approve", scope: "revoke", description: "Revoke a vault override.", category: "administration" },
  { key: "setting.read", resource: "setting", action: "read", description: "View application settings.", category: "administration" },
  { key: "setting.update", resource: "setting", action: "update", description: "Edit application settings.", category: "administration" },
  { key: "setting.integration.manage", resource: "setting", action: "update", scope: "integration", description: "Manage the GHL token and location.", category: "administration" },
  { key: "sync.read", resource: "sync", action: "read", description: "View the sync monitor.", category: "administration" },
  { key: "sync.retry", resource: "sync", action: "update", scope: "retry", description: "Retry a failed sync item.", category: "administration" },
  { key: "sync.resolve_conflict", resource: "sync", action: "update", scope: "conflict", description: "Resolve a sync conflict.", category: "administration" },
  { key: "audit.read", resource: "audit", action: "read", description: "View the audit log.", category: "administration" },
];

/**
 * Default grants for the three non-admin system roles, doc 04 §4. Admin gets
 * every key (below) since the role is unrestricted by design (doc 01). Keys
 * not listed here for a role are simply not granted to it by default; the
 * permission-matrix admin UI (FR-ADM-25, a later phase) is where finer-grained
 * exceptions get added per deployment.
 */
const NON_ADMIN_GRANTS: Record<string, string[]> = {
  sales_rep: [
    "lead.read.own",
    "lead.stage.update.all",
    "product.read",
    "estimate.read.own",
    "estimate.create",
    "estimate.send",
    "job.read.own",
    "invoice.read.own",
    "commission.read.own",
    "appointment.read.own",
  ],
  csr: [
    "lead.read.intake",
    "lead.assign",
    "lead.reassign",
    "lead.stage.update.intake",
    "appointment.read.all",
    "appointment.create",
    "appointment.update",
  ],
  installer: [
    "job.read.assigned",
    "job.stage.update.assigned",
    "job.photo.create",
    "job.issue.create",
    "appointment.read.own",
  ],
};

async function main() {
  // 1 - system roles
  const roleByKey = new Map<string, { id: string }>();
  for (const role of SYSTEM_ROLES) {
    const row = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, isSystem: true },
      create: { ...role },
    });
    roleByKey.set(role.key, row);
  }
  console.log(`Seeded ${SYSTEM_ROLES.length} system roles.`);

  // 2 - permission registry
  const permissionByKey = new Map<string, { id: string }>();
  for (const permission of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        resource: permission.resource,
        action: permission.action,
        scope: permission.scope ?? null,
        description: permission.description,
        isFieldLevel: permission.isFieldLevel ?? false,
        category: permission.category,
      },
      create: {
        key: permission.key,
        resource: permission.resource,
        action: permission.action,
        scope: permission.scope ?? null,
        description: permission.description,
        isFieldLevel: permission.isFieldLevel ?? false,
        category: permission.category,
      },
    });
    permissionByKey.set(permission.key, row);
  }
  console.log(`Seeded ${PERMISSIONS.length} permissions.`);

  // 3 - default role grants: admin gets everything, others get their listed subset
  const adminRole = roleByKey.get("admin")!;
  for (const permission of permissionByKey.values()) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    });
  }
  for (const [roleKey, keys] of Object.entries(NON_ADMIN_GRANTS)) {
    const role = roleByKey.get(roleKey)!;
    for (const key of keys) {
      const permission = permissionByKey.get(key);
      if (!permission) throw new Error(`Seed error: unknown permission key "${key}" for role "${roleKey}".`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
  console.log("Seeded default role grants.");

  // 4 - the first admin, from environment variables
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        firstName: process.env.ADMIN_FIRST_NAME ?? "Admin",
        lastName: process.env.ADMIN_LAST_NAME ?? "User",
        passwordHash,
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: adminRole.id },
    });
    console.log(`Seeded admin user ${adminEmail}.`);
  } else {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set - skipped seeding the first admin user.");
  }

  // 5 - one branding profile (decision D1: single tenant, exactly one active row)
  const existingBranding = await prisma.brandingProfile.findFirst();
  if (!existingBranding) {
    await prisma.brandingProfile.create({
      data: { companyName: "J&J Flooring World" },
    });
    console.log("Seeded default branding profile.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
