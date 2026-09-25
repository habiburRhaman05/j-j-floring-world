import type { AppRole } from "@prisma/client";

const APP_ROLE_KEYS: readonly string[] = ["admin", "sales_rep", "csr", "installer"];

/** User.role mirrors the Role row's key; a custom role has no app-role equivalent. */
export function appRoleForKey(key: string): AppRole | null {
  return APP_ROLE_KEYS.includes(key) ? (key as AppRole) : null;
}
