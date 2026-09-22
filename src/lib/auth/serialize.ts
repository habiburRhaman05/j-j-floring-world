import type { Role, User } from "@prisma/client";
import { homeForRoles } from "./session.server";

/* ==========================================================================
   serialize.ts  -  the one shape a signed-in user is sent to the client in
   --------------------------------------------------------------------------
   Shared by /api/auth/login and /api/auth/session so the two can never drift.
   Never includes passwordHash, totpSecret or backupCodes.
   ========================================================================== */

export interface SessionUserPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  timezone: string;
  mustChangePassword: boolean;
  roles: { id: string; key: string; name: string }[];
  homePath: string;
}

export function serializeSessionUser(user: User, roles: Role[]): SessionUserPayload {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    timezone: user.timezone,
    mustChangePassword: user.mustChangePassword,
    roles: roles.map((r) => ({ id: r.id, key: r.key, name: r.name })),
    homePath: homeForRoles(roles),
  };
}
