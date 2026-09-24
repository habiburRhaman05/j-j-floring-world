import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api/api-route";
import { requireApiUser } from "@/lib/auth/require-api-user";
import { resolveConnection, fetchLiveLeads, GhlNotConfiguredError } from "@/lib/ghl/leads-sync";
import { DEFAULT_COMMISSION_RATE } from "@/lib/constants";
import type { Database, Role, User } from "@/lib/types";

const ROLE_LABEL: Record<string, Role> = {
  admin: "Admin",
  sales_rep: "Sales Rep",
  csr: "CSR",
  installer: "Installer",
};

/**
 * The workspace snapshot the frontend already expects (Database shape).
 * Leads come from GHL live. Products/estimates/jobs/invoices are real tables
 * too but not wired into this snapshot yet - empty here on purpose, not a
 * bug, that is the next slice of work after CSR intake.
 */
export const GET = apiRoute(async () => {
  const gate = await requireApiUser();
  if (gate.error) return gate.error;

  const dbUsers = await prisma.user.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    include: { roles: { include: { role: true } } },
    orderBy: { firstName: "asc" },
  });

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

  const db: Database = {
    version: 1,
    seededAt: new Date().toISOString(),
    settings: { defaultCommissionRate: DEFAULT_COMMISSION_RATE },
    users,
    products: [],
    leads,
    estimates: [],
    jobs: [],
    invoices: [],
    syncLog: [],
  };

  return NextResponse.json(db);
});
