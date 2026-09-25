/* ==========================================================================
   selectors.ts  -  derived reporting
   Pure functions over a database snapshot. Keeping them here (rather than in
   the components) means the Admin report, the rep's commission view and the
   invoice all read the same numbers.
   ========================================================================== */

import { round2 } from "../format";
import { JOB_PHASES, SALES_STAGES } from "../constants";
import type {
  CompanyTotals,
  Database,
  Estimate,
  FunnelRow,
  Invoice,
  Job,
  JobFinancials,
  RepStats,
} from "../types";
import { byId, estimateTierTotals } from "./pricing";

export function invoiceForJob(db: Database, jobId: string): Invoice | null {
  return db.invoices.find((i) => i.jobId === jobId) ?? null;
}

export function estimatesForLead(db: Database, leadId: string): Estimate[] {
  return db.estimates.filter((e) => e.leadId === leadId);
}

export function jobForEstimate(db: Database, estimateId: string): Job | null {
  return db.jobs.find((j) => j.estimateId === estimateId) ?? null;
}

export function jobFinancials(db: Database, jobId: string): JobFinancials {
  const inv = invoiceForJob(db, jobId);
  if (!inv) return { totalPrice: 0, totalCost: 0, totalMargin: 0, marginPct: 0 };
  return {
    totalPrice: inv.totalPrice,
    totalCost: inv.totalCost,
    totalMargin: inv.totalMargin,
    marginPct: inv.totalPrice ? round2((inv.totalMargin / inv.totalPrice) * 100) : 0,
  };
}

export function companyTotals(db: Database): CompanyTotals {
  let price = 0;
  let cost = 0;
  let outstanding = 0;
  let collected = 0;

  for (const inv of db.invoices) {
    price += inv.totalPrice;
    cost += inv.totalCost;
    if (inv.paymentStatus === "Paid") {
      collected += inv.totalPrice;
    } else if (inv.paymentStatus === "Partial") {
      collected += inv.depositAmount;
      outstanding += inv.balanceAmount;
    } else {
      outstanding += inv.totalPrice;
    }
  }

  return {
    revenue: round2(price),
    cost: round2(cost),
    margin: round2(price - cost),
    marginPct: price ? round2(((price - cost) / price) * 100) : 0,
    outstanding: round2(outstanding),
    collected: round2(collected),
    jobCount: db.jobs.length,
  };
}

export function repStats(db: Database, repId: string): RepStats {
  const u = byId(db.users, repId);
  const won = db.leads.filter((l) => l.assignedRepId === repId && l.stage === "Won");

  let revenue = 0;
  for (const l of won) {
    for (const inv of db.invoices) {
      if (inv.leadId === l.id) revenue += inv.totalPrice;
    }
  }

  const openLeads = db.leads.filter(
    (l) => l.assignedRepId === repId && l.stage !== "Won" && l.stage !== "Lost",
  ).length;
  const dealsLost = db.leads.filter(
    (l) => l.assignedRepId === repId && l.stage === "Lost",
  ).length;
  const rate = u?.commissionRate ?? 0;

  return {
    repId,
    name: u?.name ?? repId,
    dealsWon: won.length,
    dealsLost,
    openLeads,
    revenue: round2(revenue),
    commissionRate: rate,
    commission: round2(revenue * rate),
    closeRate: won.length + dealsLost ? round2((won.length / (won.length + dealsLost)) * 100) : 0,
  };
}

export function salesFunnel(db: Database): FunnelRow[] {
  return SALES_STAGES.map((stage) => ({
    label: stage,
    count: db.leads.filter((l) => l.stage === stage).length,
    tone: stage === "Won" ? "won" : stage === "Lost" ? "lost" : undefined,
  }));
}

export function jobPipelineCounts(db: Database): FunnelRow[] {
  return JOB_PHASES.map((phase) => ({
    label: phase.label,
    count: db.jobs.filter((j) => phase.stages.includes(j.stage)).length,
  }));
}

/** Money still owed on an invoice, as the outstanding report shows it. */
export function amountOwed(inv: Invoice): number {
  return inv.paymentStatus === "Unpaid" ? inv.totalPrice : inv.balanceAmount;
}

/** The customer-facing total for whichever tier was accepted. */
export function acceptedTotal(db: Database, est: Estimate): number {
  const tier = est.acceptedTier ?? "Better";
  return estimateTierTotals(est.tiers[tier], est.tierMeta[tier]).totalPrice;
}
