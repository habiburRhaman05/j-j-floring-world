import type { Role } from "./types";

/* ==========================================================================
   navigation.ts  -  the destinations each role can reach
   --------------------------------------------------------------------------
   Each destination is a real App Router segment, so the URL says where you are
   (/admin/products) and a link can be shared, bookmarked or opened in a new
   tab. The shell derives the active tab from the pathname instead of keeping a
   client-side cursor.
   ========================================================================== */

export interface NavEntry {
  /** Stable id, also written to the section's data-view attribute. */
  key: string;
  href: string;
  label: string;
  /** SVG path data for the bottom bar. */
  icon?: string;
}

const ICON_TODAY =
  "M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18";

const ICON_JOBS =
  "M3 13h11v5H3zM14 9h4l3 4v5h-7zM7 21a2 2 0 100-4 2 2 0 000 4zM18 21a2 2 0 100-4 2 2 0 000 4z";

const ICON_DONE = "M20 6L9 17l-5-5";

export const ADMIN_NAV: NavEntry[] = [
  { key: "overview", href: "/admin", label: "Dashboard" },
  { key: "pipeline", href: "/admin/pipeline", label: "Sales Pipeline" },
  { key: "jobs", href: "/admin/jobs", label: "Jobs & Invoices" },
  { key: "products", href: "/admin/products", label: "Products" },
  { key: "team", href: "/admin/team", label: "Team" },
  { key: "sync", href: "/admin/sync", label: "Sync & Settings" },
];

export const SALES_REP_NAV: NavEntry[] = [
  { key: "pipeline", href: "/sales-rep", label: "My Pipeline" },
  { key: "estimates", href: "/sales-rep/estimates", label: "Estimates" },
  { key: "jobs", href: "/sales-rep/jobs", label: "Won Jobs" },
  { key: "calendar", href: "/sales-rep/calendar", label: "Appointments" },
  { key: "commission", href: "/sales-rep/commission", label: "Commission" },
];

export const CSR_NAV: NavEntry[] = [
  { key: "intake", href: "/csr", label: "Intake Board" },
  { key: "appointments", href: "/csr/appointments", label: "Appointments" },
];

export const INSTALLER_NAV: NavEntry[] = [
  { key: "today", href: "/installer", label: "Today", icon: ICON_TODAY },
  { key: "jobs", href: "/installer/jobs", label: "My Jobs", icon: ICON_JOBS },
  { key: "completed", href: "/installer/completed", label: "Completed", icon: ICON_DONE },
];

export const NAV_BY_ROLE: Record<Role, NavEntry[]> = {
  Admin: ADMIN_NAV,
  "Sales Rep": SALES_REP_NAV,
  CSR: CSR_NAV,
  Installer: INSTALLER_NAV,
};

/**
 * Which destination a pathname belongs to. The longest match wins, so
 * `/admin/products` beats `/admin` rather than both claiming the URL.
 */
export function activeNavKey(pathname: string, items: NavEntry[]): string {
  let best: NavEntry | null = null;

  for (const item of items) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }

  return best?.key ?? items[0]?.key ?? "";
}

/** The label the top bar shows for where you are. */
export function activeNavLabel(pathname: string, items: NavEntry[]): string {
  const key = activeNavKey(pathname, items);
  return items.find((item) => item.key === key)?.label ?? "";
}
