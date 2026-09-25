/* ==========================================================================
   database.ts  -  in-memory data layer
   --------------------------------------------------------------------------
   FRONTEND-FIRST BUILD: this module is the stand-in for the API. It holds the
   seeded data set in memory for the life of the tab, applies every domain
   operation the UI performs, and appends to the GoHighLevel sync log.

   Nothing here touches localStorage, sessionStorage or the network. When the
   real backend arrives, every method below becomes a fetch call and the
   components that call them through `useAppMutation` do not change.
   ========================================================================== */

import { round2, normaliseRate, estimateTierTotals, toInvoiceLines, blankTierMeta } from "./pricing";
import { buildSeed, uid } from "./seed";
import { invoiceForJob, jobForEstimate } from "./selectors";
import type {
  Database,
  Estimate,
  EstimateTierMeta,
  Invoice,
  Job,
  Lead,
  LeadSource,
  LeadStage,
  Product,
  ProductCategory,
  SyncDirection,
  SyncEntry,
  Tier,
  Unit,
  User,
} from "../types";

const MAX_SYNC_ENTRIES = 200;

export interface NewLeadInput {
  name: string;
  phone?: string;
  email?: string;
  zipCode?: string;
  address?: string;
  source?: LeadSource;
  assignedRepId?: string;
  note?: string;
  by?: string;
}

export interface ProductInput {
  id?: string | null;
  name: string;
  sku?: string | null;
  description?: string | null;
  category: ProductCategory;
  unit: Unit;
  costPerUnit: number | string;
  pricePerUnit: number | string;
  tier?: Tier | null;
  commissionRate?: number | string | null;
  wasteFactor?: number | string | null;
  taxable?: boolean;
  active?: boolean;
}

export interface UserInput {
  id?: string | null;
  name: string;
  /** Sign-in identity. Unique across the team. */
  email: string;
  role: User["role"];
  commissionRate: number | string;
}

export interface EstimateInput {
  id?: string | null;
  leadId: string;
  repId: string;
  depositPercent: number | string;
  tiers: Estimate["tiers"];
  tierMeta?: Record<Tier, EstimateTierMeta>;
  customerNotes?: string | null;
  internalNotes?: string | null;
  taxRate?: number | string;
}

class MockDatabase {
  private db: Database = buildSeed();
  private listeners = new Set<() => void>();

  /* ------------------------------------------------------------- reads */

  /** A detached copy, so React never holds a live handle on the store. */
  snapshot(): Database {
    return structuredClone(this.db);
  }

  settings() {
    return { ...this.db.settings };
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private commit() {
    for (const fn of this.listeners) fn();
  }

  /* ------------------------------------------------ GoHighLevel stub */

  /**
   * THIS IS A STUB. No network calls are made. When the private integration
   * token exists, only this method changes: replace the log-and-return with a
   * fetch to the GHL v2 API. Every caller stays exactly as written.
   */
  private transport(direction: SyncDirection, event: string, payload?: unknown) {
    const arrow = direction === "out" ? "App → GHL" : "GHL → App";
    if (typeof console !== "undefined") {
      console.log(`[ghlSync] ${arrow} | ${event}`, payload ?? "");
    }
    return { ok: true, stub: true, event, direction };
  }

  private record(
    direction: SyncDirection,
    event: string,
    message: string,
    payload?: unknown,
  ): SyncEntry {
    const arrow = direction === "out" ? "App → GHL: " : "GHL → App: ";
    const entry: SyncEntry = {
      id: uid("sync"),
      at: new Date().toISOString(),
      dir: direction,
      event,
      message: arrow + message,
      payload: payload ?? null,
    };
    this.db.syncLog.unshift(entry);
    if (this.db.syncLog.length > MAX_SYNC_ENTRIES) this.db.syncLog.length = MAX_SYNC_ENTRIES;
    this.transport(direction, event, payload);
    this.commit();
    return entry;
  }

  /* ------------------------------------------------------ leads */

  addLead(fields: NewLeadInput): Lead {
    const now = new Date().toISOString();
    const lead: Lead = {
      id: uid("lead"),
      name: fields.name,
      phone: fields.phone ?? "",
      email: fields.email ?? "",
      zipCode: fields.zipCode ?? "",
      address: fields.address ?? "",
      source: fields.source ?? "Other",
      assignedRepId: fields.assignedRepId || "u_rep_a",
      stage: "New Lead",
      createdAt: now,
      appointmentAt: null,
      notes: fields.note ? [{ at: now, by: fields.by ?? "u_csr", text: fields.note }] : [],
    };
    this.db.leads.unshift(lead);
    this.record("out", "contact.created", `Contact '${lead.name}' created, pipeline 'Sales', stage 'New Lead'`);
    return lead;
  }

  setLeadStage(leadId: string, stage: LeadStage): Lead | null {
    const lead = this.db.leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === stage) return lead ?? null;
    lead.stage = stage;
    this.record("out", "opportunity.stage", `Opportunity '${lead.name}' moved to '${stage}'`);
    return lead;
  }

  addLeadNote(leadId: string, text: string, actorId?: string): Lead | null {
    const lead = this.db.leads.find((l) => l.id === leadId);
    if (!lead) return null;
    lead.notes = lead.notes ?? [];
    lead.notes.unshift({ at: new Date().toISOString(), by: actorId ?? "u_csr", text });
    this.record("out", "note.created", `Note added to contact '${lead.name}'`);
    return lead;
  }

  setAppointment(leadId: string, isoDate: string): Lead | null {
    const lead = this.db.leads.find((l) => l.id === leadId);
    if (!lead) return null;
    lead.appointmentAt = isoDate;
    if (lead.stage === "New Lead" || lead.stage === "Contacted" || lead.stage === "Qualified") {
      lead.stage = "Appointment Set";
    }
    this.record("out", "appointment.created", `Appointment booked for '${lead.name}'`);
    return lead;
  }

  /* --------------------------------------------------- products */

  saveProduct(fields: ProductInput): Product {
    let p = fields.id ? this.db.products.find((x) => x.id === fields.id) : undefined;
    if (!p) {
      p = {
        id: uid("prod"),
        name: fields.name,
        sku: fields.sku ?? null,
        description: fields.description ?? null,
        category: fields.category,
        unit: fields.unit,
        costPerUnit: 0,
        pricePerUnit: 0,
        tier: fields.tier ?? null,
        commissionRate: null,
        wasteFactor: null,
        taxable: true,
        active: true,
      };
      this.db.products.push(p);
    }
    p.name = fields.name;
    p.sku = fields.sku ?? null;
    p.description = fields.description ?? null;
    p.category = fields.category;
    p.unit = fields.unit;
    p.costPerUnit = Number(fields.costPerUnit) || 0;
    p.pricePerUnit = Number(fields.pricePerUnit) || 0;
    p.tier = fields.tier ?? null;
    if (fields.commissionRate !== undefined) p.commissionRate = normaliseRate(fields.commissionRate);
    if (fields.wasteFactor !== undefined) p.wasteFactor = normaliseRate(fields.wasteFactor);
    if (typeof fields.taxable === "boolean") p.taxable = fields.taxable;
    if (typeof fields.active === "boolean") p.active = fields.active;
    this.record("out", "product.updated", `Product '${p.name}' saved to the product catalog`);
    return p;
  }

  setProductCommission(id: string, rate: number | string | null): Product | null {
    const p = this.db.products.find((x) => x.id === id);
    if (!p) return null;
    p.commissionRate = normaliseRate(rate);
    this.record(
      "out",
      "product.commission",
      `Commission on '${p.name}' set to ${
        p.commissionRate === null ? "the rep rate" : `${p.commissionRate * 100}%`
      }`,
    );
    return p;
  }

  toggleProduct(id: string): Product | null {
    const p = this.db.products.find((x) => x.id === id);
    if (!p) return null;
    p.active = !p.active;
    this.commit();
    return p;
  }

  /* ------------------------------------------------------ users */

  saveUser(fields: UserInput): User {
    let u = fields.id ? this.db.users.find((x) => x.id === fields.id) : undefined;
    if (!u) {
      u = {
        id: uid("u"),
        name: fields.name,
        email: fields.email,
        role: fields.role,
        commissionRate: 0,
      };
      this.db.users.push(u);
    }
    u.name = fields.name;
    u.email = fields.email;
    u.role = fields.role;
    u.commissionRate = Number(fields.commissionRate) || 0;
    this.commit();
    return u;
  }

  removeUser(id: string): boolean {
    if (id === "u_admin") return false;
    this.db.users = this.db.users.filter((u) => u.id !== id);
    this.commit();
    return true;
  }

  /* ------------------------------------------------- estimates */

  saveEstimate(fields: EstimateInput): Estimate {
    let e = fields.id ? this.db.estimates.find((x) => x.id === fields.id) : undefined;
    if (!e) {
      e = {
        id: uid("est"),
        number: `EST-${new Date().getFullYear()}-${String(this.db.estimates.length + 1).padStart(4, "0")}`,
        leadId: fields.leadId,
        repId: fields.repId,
        createdAt: new Date().toISOString(),
        status: "Draft",
        signedAt: null,
        signedByName: null,
        depositPercent: 30,
        acceptedTier: null,
        tiers: fields.tiers,
        tierMeta: fields.tierMeta ?? { Good: blankTierMeta(), Better: blankTierMeta(), Best: blankTierMeta() },
        customerNotes: fields.customerNotes ?? null,
        internalNotes: fields.internalNotes ?? null,
        taxRate: 0,
      };
      this.db.estimates.push(e);
    }
    e.leadId = fields.leadId;
    e.repId = fields.repId;
    // A zero deposit is a real choice, so only a missing/garbled value falls back.
    const deposit = Number(fields.depositPercent);
    e.depositPercent = Number.isFinite(deposit) ? Math.min(Math.max(deposit, 0), 100) : 30;
    e.tiers = fields.tiers;
    if (fields.tierMeta) e.tierMeta = fields.tierMeta;
    if (fields.taxRate !== undefined) e.taxRate = Math.max(Number(fields.taxRate) || 0, 0);
    if (fields.customerNotes !== undefined) e.customerNotes = fields.customerNotes;
    if (fields.internalNotes !== undefined) e.internalNotes = fields.internalNotes;
    this.commit();
    return e;
  }

  sendEstimate(estId: string): Estimate | null {
    const e = this.db.estimates.find((x) => x.id === estId);
    if (!e) return null;
    e.status = "Sent";
    const lead = this.db.leads.find((l) => l.id === e.leadId);
    this.setLeadStage(e.leadId, "Estimate Sent");
    this.record("out", "estimate.sent", `Estimate ${e.id} sent to '${lead ? lead.name : e.leadId}'`);
    this.commit();
    return e;
  }

  markEstimateViewed(estId: string): Estimate | null {
    const e = this.db.estimates.find((x) => x.id === estId);
    if (!e || e.status !== "Sent") return e ?? null;
    e.status = "Viewed";
    this.record("in", "estimate.viewed", `Estimate ${e.id} opened by customer`);
    return e;
  }

  /**
   * Signing is the hinge of the whole demo: it wins the lead, creates the job
   * and the invoice, and fires three sync events. The deposit is recorded as
   * paid at signature to keep the click-through short; a real build would wait
   * on a payment webhook from GoHighLevel.
   */
  signEstimate(estId: string, typedName: string, tier: Tier) {
    const e = this.db.estimates.find((x) => x.id === estId);
    if (!e) return null;

    e.status = "Signed";
    e.signedAt = new Date().toISOString();
    e.signedByName = typedName;
    e.acceptedTier = tier;
    this.setLeadStage(e.leadId, "Won");

    const existing = jobForEstimate(this.db, e.id);
    const job: Job =
      existing ??
      {
        id: uid("job"),
        leadId: e.leadId,
        estimateId: e.id,
        stage: "Deposit Paid",
        scheduledDate: null,
        installerId: null,
        materialsReceived: false,
        photos: [],
        completedAt: null,
        adminConfirmedAt: null,
        createdAt: new Date().toISOString(),
      };
    if (!existing) this.db.jobs.unshift(job);

    const totals = this.totalsForEstimate(e, tier);
    const deposit = round2(totals.totalPrice * (e.depositPercent / 100));

    let invoice = existing ? invoiceForJob(this.db, job.id) : null;
    if (!invoice) {
      invoice = {
        id: uid("inv"),
        jobId: job.id,
        estimateId: e.id,
        leadId: e.leadId,
        repId: e.repId,
        tier,
        lineItems: toInvoiceLines(e.tiers[tier]),
        totalPrice: totals.totalPrice,
        totalCost: totals.totalCost,
        totalMargin: totals.totalMargin,
        depositPercent: e.depositPercent,
        depositAmount: deposit,
        depositPaid: true,
        balanceAmount: round2(totals.totalPrice - deposit),
        paymentStatus: "Partial",
        paidAt: null,
        createdAt: new Date().toISOString(),
      };
      this.db.invoices.unshift(invoice);
    } else {
      invoice.estimateId = e.id;
      invoice.leadId = e.leadId;
      invoice.repId = e.repId;
      invoice.tier = tier;
      invoice.lineItems = toInvoiceLines(e.tiers[tier]);
      invoice.totalPrice = totals.totalPrice;
      invoice.totalCost = totals.totalCost;
      invoice.totalMargin = totals.totalMargin;
      invoice.depositPercent = e.depositPercent;
      invoice.depositAmount = deposit;
      invoice.depositPaid = true;
      invoice.balanceAmount = round2(totals.totalPrice - deposit);
      invoice.paymentStatus = "Partial";
      invoice.paidAt = null;
    }

    const lead = this.db.leads.find((l) => l.id === e.leadId);
    const who = lead ? lead.name : e.leadId;
    this.record("out", "estimate.signed", `Estimate ${e.id} signed by '${typedName}' (${tier} tier)`);
    this.record("out", "job.created", `Job ${job.id} created for '${who}', pipeline 'Installation', stage 'Deposit Paid'`);
    this.record("out", "invoice.created", `Invoice ${invoice.id} created, deposit recorded`);

    return { estimate: e, job, invoice };
  }

  private totalsForEstimate(estimate: Estimate, tier: Tier) {
    return estimateTierTotals(estimate.tiers[tier], estimate.tierMeta[tier], estimate.taxRate);
  }

  /* ------------------------------------------------------- jobs */

  setJobStage(jobId: string, stage: Job["stage"]): Job | null {
    const job = this.db.jobs.find((j) => j.id === jobId);
    if (!job || job.stage === stage) return job ?? null;
    job.stage = stage;
    if (stage === "Completed") job.completedAt = new Date().toISOString();
    const lead = this.db.leads.find((l) => l.id === job.leadId);
    this.record("out", "job.stage", `Job '${lead ? lead.name : job.id}' moved to '${stage}'`);
    return job;
  }

  assignInstaller(jobId: string, installerId: string | null, isoDate?: string | null): Job | null {
    const job = this.db.jobs.find((j) => j.id === jobId);
    if (!job) return null;
    job.installerId = installerId || null;
    if (isoDate) job.scheduledDate = isoDate;

    const stageIndex = ["Deposit Paid", "Materials Ordered", "Ready to Schedule", "Scheduled", "En Route", "In Progress", "Completed"].indexOf(job.stage);
    if (job.installerId && job.scheduledDate && stageIndex < 3) job.stage = "Scheduled";

    const lead = this.db.leads.find((l) => l.id === job.leadId);
    const installer = this.db.users.find((u) => u.id === installerId);
    this.record("out", "job.assigned", `Job '${lead ? lead.name : job.id}' assigned to ${installer ? installer.name : "unassigned"}`);
    return job;
  }

  setMaterialsReceived(jobId: string, value: boolean): Job | null {
    const job = this.db.jobs.find((j) => j.id === jobId);
    if (!job) return null;
    job.materialsReceived = !!value;
    const lead = this.db.leads.find((l) => l.id === job.leadId);
    this.record(
      "out",
      "job.materials",
      `Materials ${value ? "confirmed received" : "marked outstanding"} for '${lead ? lead.name : job.id}'`,
    );
    return job;
  }

  addJobPhoto(jobId: string, label: string, name: string): Job | null {
    const job = this.db.jobs.find((j) => j.id === jobId);
    if (!job) return null;
    job.photos = job.photos ?? [];
    job.photos.push({ id: uid("ph"), label, name, at: new Date().toISOString() });
    this.record("out", "job.photo", `${label} photo attached to job ${job.id}`);
    return job;
  }

  confirmJob(jobId: string): Job | null {
    const job = this.db.jobs.find((j) => j.id === jobId);
    if (!job) return null;
    job.adminConfirmedAt = new Date().toISOString();
    const lead = this.db.leads.find((l) => l.id === job.leadId);
    this.record("out", "job.confirmed", `Job '${lead ? lead.name : job.id}' confirmed complete by office`);
    return job;
  }

  /* --------------------------------------------------- invoices */

  setPaymentStatus(invoiceId: string, status: Invoice["paymentStatus"]): Invoice | null {
    const inv = this.db.invoices.find((i) => i.id === invoiceId);
    if (!inv) return null;
    inv.paymentStatus = status;
    if (status === "Paid") {
      inv.paidAt = new Date().toISOString();
      inv.depositPaid = true;
    }
    if (status === "Unpaid") {
      inv.depositPaid = false;
      inv.paidAt = null;
    }
    const lead = this.db.leads.find((l) => l.id === inv.leadId);
    this.record("out", "invoice.payment", `Invoice ${inv.id} for '${lead ? lead.name : ""}' marked ${status}`);
    return inv;
  }

  /* ------------------------------------------------ demo controls */

  resetDemoData(): void {
    this.db = buildSeed();
    this.commit();
  }

  clearSyncLog(): void {
    this.db.syncLog = [];
    this.commit();
  }

  /** Stands in for a GoHighLevel webhook arriving. */
  simulateInboundEvent(): void {
    const leads = this.db.leads;
    if (!leads.length) return;
    const lead = leads[Math.floor(Math.random() * leads.length)];
    this.record("in", "contact.updated", `Contact '${lead.name}' updated in GHL workflow`);
  }
}

/** One store per browser session. */
export const db = new MockDatabase();

/**
 * The workspace before anything has loaded. Views read this on the first paint
 * against a real server, so every list renders its empty state rather than
 * crashing on undefined.
 */
export function emptyDatabase(): Database {
  return {
    version: 0,
    seededAt: "",
    settings: { defaultCommissionRate: 0 },
    users: [],
    products: [],
    leads: [],
    estimates: [],
    jobs: [],
    invoices: [],
    syncLog: [],
  };
}
