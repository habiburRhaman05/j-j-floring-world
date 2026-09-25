/* ==========================================================================
   auth-service.ts  -  real, database-backed sign in
   --------------------------------------------------------------------------
   The mock/HTTP dual-service pattern this file used to have is gone: identity
   always talks to the real API now, regardless of NEXT_PUBLIC_USE_MOCK_API
   (that flag still governs the still-mock product/lead/job/estimate/invoice
   modules elsewhere, which are untouched by this file).
   ========================================================================== */

import { apiGet, apiPost } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { Role } from "../types";

/** The shape the server sends back for the signed-in user (see src/lib/auth/serialize.ts). */
export interface ServerSessionUser {
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

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
}

/** The dashboard role keys this build gates on, mapped to the display label the UI already uses everywhere. */
const ROLE_KEY_TO_LABEL: Record<string, Role> = {
  admin: "Admin",
  sales_rep: "Sales Rep",
  csr: "CSR",
  installer: "Installer",
};

function toSessionUser(payload: ServerSessionUser): SessionUser {
  const match = payload.roles.find((r) => r.key in ROLE_KEY_TO_LABEL);
  if (!match) {
    throw new Error("This account has no dashboard role assigned. Contact an administrator.");
  }
  return {
    id: payload.id,
    email: payload.email,
    name: `${payload.firstName} ${payload.lastName}`.trim(),
    role: ROLE_KEY_TO_LABEL[match.key]!,
    mustChangePassword: payload.mustChangePassword,
  };
}

/** Called once on mount to hydrate whatever session cookie the browser already holds. */
export async function fetchCurrentSession(): Promise<SessionUser | null> {
  const { user } = await apiGet<{ user: ServerSessionUser | null }>(endpoints.auth.session);
  return user ? toSessionUser(user) : null;
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const { user } = await apiPost<{ user: ServerSessionUser }>(
    endpoints.auth.login,
    { email, password },
  );
  return toSessionUser(user);
}

export async function signOutRequest(): Promise<void> {
  await apiPost<void>(endpoints.auth.logout);
}

/** The workspace a role lands on once it signs in. */
export const ROLE_HOME: Record<Role, string> = {
  Admin: "/admin",
  "Sales Rep": "/sales-rep",
  CSR: "/csr",
  Installer: "/installer",
};
