import type { Role } from "../types";

/**
 * Permission gate. Cost, margin and commission are Admin-only; the views
 * consult this before BUILDING the nodes, so those numbers never reach the
 * DOM for the other roles. Inspecting a rep's rendered page in dev tools
 * turns up nothing to unhide, because there is no hidden element.
 *
 * This is a render-layer rule, not a CSS rule.
 */
export const can = {
  viewCost: (role: Role | null) => role === "Admin",
  viewMargin: (role: Role | null) => role === "Admin",
  viewPrice: (role: Role | null) => role === "Admin" || role === "Sales Rep",
  viewOwnCommission: (role: Role | null) => role === "Sales Rep" || role === "Admin",
  manageProducts: (role: Role | null) => role === "Admin",
  manageUsers: (role: Role | null) => role === "Admin",
};
