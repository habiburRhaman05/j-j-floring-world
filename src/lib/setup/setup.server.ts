import "server-only";
import { randomInt, timingSafeEqual } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { AppRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto/secret-box";
import { hashPassword } from "@/lib/auth/password";
import {
  connectionFromCredentials,
  getCompanyEmail,
  getLocation,
  ghlRoleOf,
  isLocationUser,
  listLocationUsers,
  type GhlLocation,
} from "@/lib/ghl/client";
import type { SetupCredential, SetupGhlUser } from "./types";

/* ==========================================================================
   setup.server.ts  -  first-run setup: GHL sub-account users -> app users
   --------------------------------------------------------------------------
   1. verify   the PIT token + Location ID against GHL, list the sub-account's
               users (agency users are left out).
   2. complete re-verifies, backs up the current users to /backups, then in
               one transaction replaces every app user with the selected GHL
               users, each with the chosen app role and a temporary password.

   Guarded by SETUP_KEY (from .env) and usable exactly once: after it
   succeeds, `setupCompletedAt` is stamped and every setup route refuses.
   ========================================================================== */

export class SetupError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "SetupError";
  }
}

const PROVIDER = "gohighlevel";

const SYSTEM_ROLES = [
  { key: "admin", name: "Administrator", description: "Full access to every module and setting.", defaultScope: "all", sortOrder: 10 },
  { key: "csr", name: "CSR", description: "Intake, lead assignment and appointment booking.", defaultScope: "team", sortOrder: 20 },
  { key: "sales_rep", name: "Sales Representative", description: "Own leads, estimates and commissions.", defaultScope: "own", sortOrder: 30 },
  { key: "installer", name: "Installer", description: "Assigned jobs, schedules, photos and issues.", defaultScope: "own", sortOrder: 40 },
] as const;

export const APP_ROLES: readonly AppRole[] = ["admin", "csr", "sales_rep", "installer"];

/* ------------------------------------------------------------------ guard */

export async function isSetupComplete(): Promise<boolean> {
  const credential = await prisma.integrationCredential.findUnique({
    where: { provider: PROVIDER },
    select: { setupCompletedAt: true },
  });
  return Boolean(credential?.setupCompletedAt);
}

/** Setup is open only while not yet completed, and only to someone holding SETUP_KEY. */
export async function assertSetupAllowed(setupKey: string): Promise<void> {
  if (await isSetupComplete()) {
    throw new SetupError("Setup has already been completed. Sign in as an admin instead.", 409, "setup_complete");
  }
  const expected = process.env.SETUP_KEY;
  if (!expected) {
    throw new SetupError("SETUP_KEY is not set on the server. Add it to .env and restart.", 503, "setup_key_missing");
  }
  const a = Buffer.from(setupKey);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new SetupError("That setup key is not correct.", 403, "setup_key_invalid");
  }
}

/* ----------------------------------------------------------------- verify */

function displayName(user: { name?: string; firstName?: string; lastName?: string; email?: string }): string {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Unnamed user";
}

/** Staff roles: what everyone except the agency owner can be given. */
export const STAFF_ROLES: readonly AppRole[] = ["csr", "sales_rep", "installer"];

export interface VerifiedSetup {
  location: GhlLocation;
  users: SetupGhlUser[];
  /** The agency owner, who becomes the app Admin automatically. Null when it could not be told apart. */
  ownerGhlUserId: string | null;
  /** How the owner was identified, shown on the setup page. */
  ownerDetectedBy: "company_email" | "location_email" | "only_agency_admin" | null;
}

/**
 * GHL has no "owner" flag on a user, so the agency owner is the agency admin
 * whose email matches the agency (company) email, else the sub-account's
 * business email, else the only agency admin there is.
 */
async function detectOwner(
  connection: ReturnType<typeof connectionFromCredentials>,
  location: GhlLocation,
  users: SetupGhlUser[],
): Promise<Pick<VerifiedSetup, "ownerGhlUserId" | "ownerDetectedBy">> {
  const agencyAdmins = users.filter((u) => u.ghlRole === "agency:admin");
  const byEmail = (email: string | null) =>
    email ? agencyAdmins.find((u) => u.email === email) : undefined;

  const companyEmail = location.companyId ? await getCompanyEmail(connection, location.companyId) : null;
  const viaCompany = byEmail(companyEmail);
  if (viaCompany) return { ownerGhlUserId: viaCompany.ghlUserId, ownerDetectedBy: "company_email" };

  const viaLocation = byEmail(location.email);
  if (viaLocation) return { ownerGhlUserId: viaLocation.ghlUserId, ownerDetectedBy: "location_email" };

  if (agencyAdmins.length === 1) {
    return { ownerGhlUserId: agencyAdmins[0]!.ghlUserId, ownerDetectedBy: "only_agency_admin" };
  }
  return { ownerGhlUserId: null, ownerDetectedBy: null };
}

/** Proves the credentials work and returns every agency and sub-account user of the location. */
export async function verifyGhlCredentials(credential: SetupCredential): Promise<VerifiedSetup> {
  const connection = connectionFromCredentials(credential.token.trim(), credential.locationId.trim());

  let location: GhlLocation;
  try {
    location = await getLocation(connection);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const status = /GHL (401|403) /.test(detail) ? "The token was rejected" : "The location could not be read";
    throw new SetupError(
      `${status}. Check the PIT token has the locations, users and contacts scopes, and the Location ID is the sub-account's.`,
      422,
      "ghl_credentials_invalid",
    );
  }

  let raw;
  try {
    raw = await listLocationUsers(connection);
  } catch {
    throw new SetupError(
      "Connected, but GoHighLevel refused to list users. Add the users.readonly scope to the PIT token.",
      422,
      "ghl_users_scope",
    );
  }

  const users: SetupGhlUser[] = raw
    .filter((u) => isLocationUser(u, location.id))
    .map((u) => ({
      ghlUserId: u.id,
      name: displayName(u),
      firstName: u.firstName ?? displayName(u).split(" ")[0] ?? "",
      lastName: u.lastName ?? displayName(u).split(" ").slice(1).join(" "),
      email: (u.email ?? "").trim().toLowerCase(),
      ghlRole: ghlRoleOf(u),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const owner = await detectOwner(connection, location, users);
  // Owner first, so the row that is decided for you sits at the top.
  users.sort((a, b) => Number(b.ghlUserId === owner.ownerGhlUserId) - Number(a.ghlUserId === owner.ownerGhlUserId));
  return { location, users, ...owner };
}

/* --------------------------------------------------------------- complete */

/** No look-alike characters (0/O, 1/l/I), so it survives being read aloud or retyped. */
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function temporaryPassword(length = 14): string {
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

export interface CreatedCredential {
  name: string;
  email: string;
  role: AppRole;
  ghlRole: string;
  ghlUserId: string;
  temporaryPassword: string;
}

/** Writes every current user (and their roles) to backups/ before they are deleted. */
async function backupUsers(): Promise<string | null> {
  const users = await prisma.user.findMany({ include: { roles: { include: { role: true } } } });
  if (users.length === 0) return null;
  const dir = path.join(process.cwd(), "backups");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `users-before-setup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(file, JSON.stringify({ exportedAt: new Date().toISOString(), users }, null, 2), "utf8");
  return file;
}

export async function completeSetup(
  credential: SetupCredential,
  assignments: { ghlUserId: string; role: AppRole }[],
): Promise<{ location: GhlLocation; created: CreatedCredential[]; backupFile: string | null }> {
  const { location, users, ownerGhlUserId } = await verifyGhlCredentials(credential);
  const byId = new Map(users.map((u) => [u.ghlUserId, u] as const));

  // The owner is always the Admin; with an owner known, everyone else is staff.
  const requested = assignments.filter((a) => a.ghlUserId !== ownerGhlUserId);
  if (ownerGhlUserId && requested.some((a) => a.role === "admin")) {
    throw new SetupError("Only the agency owner is the Admin. Give everyone else a staff role.", 422, "admin_reserved");
  }
  if (ownerGhlUserId) requested.unshift({ ghlUserId: ownerGhlUserId, role: "admin" });

  const picked = requested
    .filter((a) => APP_ROLES.includes(a.role))
    .map((a) => ({ user: byId.get(a.ghlUserId), role: a.role }))
    .filter((a): a is { user: SetupGhlUser; role: AppRole } => Boolean(a.user));

  if (picked.length === 0) {
    throw new SetupError("Give at least one user an app role.", 422, "no_users");
  }
  if (!picked.some((p) => p.role === "admin")) {
    throw new SetupError("At least one user must be an Admin, or nobody could manage the app.", 422, "no_admin");
  }
  const missingEmail = picked.find((p) => !p.user.email);
  if (missingEmail) {
    throw new SetupError(`${missingEmail.user.name} has no email in GoHighLevel, so they cannot sign in.`, 422, "missing_email");
  }
  const emails = new Set<string>();
  for (const p of picked) {
    if (emails.has(p.user.email)) {
      throw new SetupError(`Two selected users share the email ${p.user.email}.`, 422, "duplicate_email");
    }
    emails.add(p.user.email);
  }

  // Argon2 is deliberately slow; hash before the transaction opens so it stays short.
  const prepared = await Promise.all(
    picked.map(async (p) => {
      const password = temporaryPassword();
      return { ...p, password, passwordHash: await hashPassword(password) };
    }),
  );

  const backupFile = await backupUsers();

  await prisma.$transaction(
    async (tx) => {
      // Invitations point at their sender with ON DELETE RESTRICT, so they go first.
      await tx.userInvitation.deleteMany({});
      await tx.user.deleteMany({});

      const roleIdByKey = new Map<string, string>();
      for (const role of SYSTEM_ROLES) {
        const row = await tx.role.upsert({
          where: { key: role.key },
          update: { name: role.name, description: role.description, isSystem: true, deletedAt: null },
          create: { ...role, isSystem: true },
        });
        roleIdByKey.set(role.key, row.id);
      }

      let firstAdminId: string | null = null;
      for (const p of prepared) {
        const created = await tx.user.create({
          data: {
            email: p.user.email,
            firstName: p.user.firstName || p.user.name,
            lastName: p.user.lastName,
            passwordHash: p.passwordHash,
            status: "ACTIVE",
            mustChangePassword: true,
            ghlUserId: p.user.ghlUserId,
            ghlRole: p.user.ghlRole,
            role: p.role,
            roles: { create: { roleId: roleIdByKey.get(p.role)! } },
          },
        });
        if (p.role === "admin" && !firstAdminId) firstAdminId = created.id;
      }

      const now = new Date();
      await tx.integrationCredential.upsert({
        where: { provider: PROVIDER },
        create: {
          provider: PROVIDER,
          locationId: location.id,
          companyId: location.companyId,
          encryptedToken: encryptSecret(credential.token.trim()),
          encryptionKeyId: "env:ENCRYPTION_KEY",
          connectedAt: now,
          connectedById: firstAdminId,
          lastVerifiedAt: now,
          setupCompletedAt: now,
        },
        update: {
          locationId: location.id,
          companyId: location.companyId,
          encryptedToken: encryptSecret(credential.token.trim()),
          connectedAt: now,
          connectedById: firstAdminId,
          lastVerifiedAt: now,
          lastVerifyError: null,
          setupCompletedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: firstAdminId,
          action: "setup.completed",
          entity: "IntegrationCredential",
          entityId: location.id,
          after: {
            locationName: location.name,
            users: prepared.map((p) => ({ ghlUserId: p.user.ghlUserId, email: p.user.email, role: p.role })),
            backupFile,
          },
        },
      });
    },
    { timeout: 30_000 },
  );

  return {
    location,
    backupFile,
    created: prepared.map((p) => ({
      name: p.user.name,
      email: p.user.email,
      role: p.role,
      ghlRole: p.user.ghlRole,
      ghlUserId: p.user.ghlUserId,
      temporaryPassword: p.password,
    })),
  };
}
