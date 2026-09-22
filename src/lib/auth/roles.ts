import type { Role } from "../types";

export interface RoleDef {
  key: Role;
  /** Route the role lands on after sign-in. */
  href: string;
  /** The accent the sign-in card paints its rail and icon with. */
  accent: string;
  label: string;
  blurb: string;
  /** SVG path data, drawn with the shared 24x24 stroke icon set. */
  icon: string;
}

export const ROLES: RoleDef[] = [
  {
    key: "Admin",
    href: "/admin",
    accent: "var(--blue)",
    label: "Admin",
    blurb: "Full visibility. Revenue, cost, margin, products, users and the GHL sync log.",
    icon: "M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6",
  },
  {
    key: "Sales Rep",
    href: "/sales-rep",
    accent: "var(--gold)",
    label: "Sales Rep / Estimator",
    blurb: "Own pipeline, estimate builder with Good/Better/Best, e-signature, commission tracker.",
    icon: "M4 19V5a1 1 0 011-1h9l6 6v9a1 1 0 01-1 1H5a1 1 0 01-1-1zM14 4v6h6M8 13h8M8 17h5",
  },
  {
    key: "CSR",
    href: "/csr",
    accent: "var(--slate)",
    label: "CSR",
    blurb: "Intake and booking. Early-stage leads, outreach notes, appointments. No money anywhere.",
    icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  },
  {
    key: "Installer",
    href: "/installer",
    accent: "var(--moss)",
    label: "Installer",
    blurb: "Today on the truck. Assigned jobs, scope of work, status updates, job photos.",
    icon: "M3 13h11v5H3zM14 9h4l3 4v5h-7zM7 21a2 2 0 100-4 2 2 0 000 4zM18 21a2 2 0 100-4 2 2 0 000 4z",
  },
];

export function roleDef(key: Role | null | undefined): RoleDef | null {
  if (!key) return null;
  return ROLES.find((r) => r.key === key) ?? null;
}

/** The label the top bar shows for a role. */
export function roleLabel(key: Role | null | undefined): string {
  const def = roleDef(key);
  return def ? def.label : key ?? "";
}
