/* ==========================================================================
   cookie-names.ts  -  one session per dashboard
   --------------------------------------------------------------------------
   Each dashboard keeps its own pair of cookies, so one browser can be signed
   in as the Admin at /admin, a CSR at /csr and a Sales Rep at /sales-rep at
   the same time, and switching role is just opening the other URL:

     jjf_admin_session      jjf_admin_refresh
     jjf_csr_session        jjf_csr_refresh
     jjf_sales_rep_session  jjf_sales_rep_refresh
     jjf_installer_session  jjf_installer_refresh

   Which pair a request uses is its "scope", sent as the x-jjf-scope header:
   proxy.ts sets it for page loads from the URL, and the API client sets it
   from the page the request comes from. Plain constants only, so proxy.ts
   can import this without pulling in Prisma.
   ========================================================================== */

export const SESSION_SCOPES = ["admin", "sales_rep", "csr", "installer"] as const;
export type SessionScope = (typeof SESSION_SCOPES)[number];

/** Request header carrying the scope. */
export const SCOPE_HEADER = "x-jjf-scope";

export function sessionCookieName(scope: SessionScope): string {
  return `jjf_${scope}_session`;
}

export function refreshCookieName(scope: SessionScope): string {
  return `jjf_${scope}_refresh`;
}

export function isSessionScope(value: string | null | undefined): value is SessionScope {
  return !!value && (SESSION_SCOPES as readonly string[]).includes(value);
}

const SCOPE_BY_SEGMENT: Record<string, SessionScope> = {
  admin: "admin",
  "sales-rep": "sales_rep",
  csr: "csr",
  installer: "installer",
};

/** The dashboard a path belongs to: "/sales-rep/estimates" -> "sales_rep". Null outside a dashboard. */
export function scopeForPath(pathname: string | null | undefined): SessionScope | null {
  const first = (pathname ?? "").split("/").filter(Boolean)[0] ?? "";
  return SCOPE_BY_SEGMENT[first] ?? null;
}
