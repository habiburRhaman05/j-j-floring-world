import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api/api-route";
import { requireApiUser } from "@/lib/auth/require-api-user";
import { resolveConnection, fetchLiveLeads, GhlNotConfiguredError } from "@/lib/ghl/leads-sync";
import { DEFAULT_COMMISSION_RATE } from "@/lib/constants";
import { toProduct } from "@/lib/products/map";
import { listEstimatesForViewer } from "@/lib/estimates/estimates.server";
import { syncEstimateDocuments } from "@/lib/estimates/lifecycle.server";
import { getGhlConnection } from "@/lib/ghl/client";
import type { Database, Role, User } from "@/lib/types";

const ROLE_LABEL: Record<string, Role> = {
  admin: "Admin",
  sales_rep: "Sales Rep",
  csr: "CSR",
  installer: "Installer",
};

/**
 * The workspace snapshot the frontend already expects (Database shape).
 * Leads come from GHL live. Products come from the catalog table. Estimates
 * come from Postgres, scoped per role. Jobs and invoices are real tables too
 * but not wired into this snapshot yet.
 */
export const GET = apiRoute(async () => {
  const gate = await requireApiUser();
  if (gate.error) return gate.error;

  const [dbUsers, dbProducts] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: { roles: { include: { role: true } } },
      orderBy: { firstName: "asc" },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const users: User[] = dbUsers.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    email: u.email,
    role: ROLE_LABEL[u.roles[0]?.role.key ?? "sales_rep"] ?? "Sales Rep",
    commissionRate: DEFAULT_COMMISSION_RATE,
  }));

  let leads: Database["leads"] = [];
  try {
    const connection = await resolveConnection();
    const result = await fetchLiveLeads(connection);
    leads = result.leads;
  } catch (error) {
    // Not connected yet, or pipeline not configured - the board shows its
    // own empty state; workspace still loads for every other view.
    if (!(error instanceof GhlNotConfiguredError)) {
      console.error("[workspace] GHL lead fetch failed:", error);
    }
  }

  // Estimates live in Postgres: an admin gets all, a rep their own, nobody else any.
  const roleKeys = gate.session.roles.map((r) => r.key);
  const isAdmin = roleKeys.includes("admin");
  let estimates: Database["estimates"] = [];
  if (isAdmin || roleKeys.includes("sales_rep")) {
    const viewer = { userId: gate.session.user.id, isAdmin, ghlUserId: gate.session.user.ghlUserId };
    // Pick up signatures the customer made since the last load; failure just leaves statuses as they were.
    try {
      const connection = await getGhlConnection();
      if (connection) await syncEstimateDocuments(connection, viewer);
    } catch (error) {
      console.error("[workspace] estimate document sync failed:", error);
    }
    const result = await listEstimatesForViewer({
      userId: gate.session.user.id,
      isAdmin,
      ghlUserId: gate.session.user.ghlUserId,
    });
    estimates = result.estimates;
    // Customers an estimate was written for, when the live lead list does not already have them.
    const known = new Set(leads.map((l) => l.id));
    leads = [...leads, ...result.leads.filter((l) => !known.has(l.id))];
  }

  const db: Database = {
    version: 1,
    seededAt: new Date().toISOString(),
    settings: { defaultCommissionRate: DEFAULT_COMMISSION_RATE },
    users,
    products: dbProducts.map(toProduct),
    leads,
    estimates,
    jobs: [],
    invoices: [],
    syncLog: [],
  };

  return NextResponse.json(db);
});
