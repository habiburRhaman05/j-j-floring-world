/* ==========================================================================
   repository.ts  -  the one seam between the UI and its data
   --------------------------------------------------------------------------
   The UI never calls axios and never touches the mock store. It calls a
   `WorkspaceRepository`, and which implementation it gets is decided by
   `config.ts`. Both implementations answer the same async contract, so
   flipping NEXT_PUBLIC_USE_MOCK_API is the whole migration.

   `mockRepository`  - wraps the in-memory store (database.ts).
   `httpRepository`  - one axios call per method, via the endpoint map.
   ========================================================================== */

import type {
  Database,
  Estimate,
  Invoice,
  Job,
  Lead,
  LeadStage,
  Product,
  SyncEntry,
  Tier,
  User,
} from "../types";
import { USE_MOCK_API } from "./config";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./client";
import { endpoints } from "./endpoints";
import { db as mockDb, type EstimateInput, type NewLeadInput, type ProductInput, type UserInput } from "../data/database";

export type { EstimateInput, NewLeadInput, ProductInput, UserInput };

/** Everything a signed-in user can do to the workspace. */
export interface WorkspaceRepository {
  /** Read the whole workspace in one call. */
  getSnapshot(): Promise<Database>;

  /**
   * A synchronous first paint, when the implementation can offer one.
   * The mock store can; a real server cannot, and returns null so the UI
   * shows its loading state instead.
   */
  getInitialSnapshot(): Database | null;

  /* leads */
  addLead(fields: NewLeadInput): Promise<Lead>;
  setLeadStage(leadId: string, stage: LeadStage): Promise<Lead | null>;
  addLeadNote(leadId: string, text: string, actorId?: string): Promise<Lead | null>;
  setAppointment(leadId: string, isoDate: string): Promise<Lead | null>;

  /* products */
  saveProduct(fields: ProductInput): Promise<Product>;
  setProductCommission(productId: string, rate: number | string | null): Promise<Product | null>;
  toggleProduct(productId: string): Promise<Product | null>;

  /* users */
  saveUser(fields: UserInput): Promise<User>;
  removeUser(userId: string): Promise<boolean>;

  /* estimates */
  saveEstimate(fields: EstimateInput): Promise<Estimate>;
  sendEstimate(estimateId: string): Promise<Estimate | null>;
  markEstimateViewed(estimateId: string): Promise<Estimate | null>;
  signEstimate(
    estimateId: string,
    typedName: string,
    tier: Tier,
  ): Promise<{ estimate: Estimate; job: Job; invoice: Invoice } | null>;

  /* jobs */
  setJobStage(jobId: string, stage: Job["stage"]): Promise<Job | null>;
  assignInstaller(
    jobId: string,
    installerId: string | null,
    isoDate?: string | null,
  ): Promise<Job | null>;
  setMaterialsReceived(jobId: string, value: boolean): Promise<Job | null>;
  addJobPhoto(jobId: string, label: string, name: string): Promise<Job | null>;
  confirmJob(jobId: string): Promise<Job | null>;

  /* invoices */
  setPaymentStatus(invoiceId: string, status: Invoice["paymentStatus"]): Promise<Invoice | null>;

  /* demo controls */
  resetDemoData(): Promise<void>;
  clearSyncLog(): Promise<void>;
  simulateInboundEvent(): Promise<SyncEntry | void>;
}

/* ------------------------------------------------------ mock implementation */

export function createMockRepository(): WorkspaceRepository {
  return {
    getSnapshot: async () => mockDb.snapshot(),
    getInitialSnapshot: () => mockDb.snapshot(),

    addLead: async (fields) => mockDb.addLead(fields),
    setLeadStage: async (leadId, stage) => mockDb.setLeadStage(leadId, stage),
    addLeadNote: async (leadId, text, actorId) => mockDb.addLeadNote(leadId, text, actorId),
    setAppointment: async (leadId, isoDate) => mockDb.setAppointment(leadId, isoDate),

    saveProduct: async (fields) => mockDb.saveProduct(fields),
    setProductCommission: async (productId, rate) => mockDb.setProductCommission(productId, rate),
    toggleProduct: async (productId) => mockDb.toggleProduct(productId),

    saveUser: async (fields) => mockDb.saveUser(fields),
    removeUser: async (userId) => mockDb.removeUser(userId),

    saveEstimate: async (fields) => mockDb.saveEstimate(fields),
    sendEstimate: async (estimateId) => mockDb.sendEstimate(estimateId),
    markEstimateViewed: async (estimateId) => mockDb.markEstimateViewed(estimateId),
    signEstimate: async (estimateId, typedName, tier) =>
      mockDb.signEstimate(estimateId, typedName, tier),

    setJobStage: async (jobId, stage) => mockDb.setJobStage(jobId, stage),
    assignInstaller: async (jobId, installerId, isoDate) =>
      mockDb.assignInstaller(jobId, installerId, isoDate),
    setMaterialsReceived: async (jobId, value) => mockDb.setMaterialsReceived(jobId, value),
    addJobPhoto: async (jobId, label, name) => mockDb.addJobPhoto(jobId, label, name),
    confirmJob: async (jobId) => mockDb.confirmJob(jobId),

    setPaymentStatus: async (invoiceId, status) => mockDb.setPaymentStatus(invoiceId, status),

    resetDemoData: async () => {
      mockDb.resetDemoData();
    },
    clearSyncLog: async () => {
      mockDb.clearSyncLog();
    },
    simulateInboundEvent: async () => {
      mockDb.simulateInboundEvent();
    },
  };
}

/* ------------------------------------------------------ HTTP implementation */

export function createHttpRepository(): WorkspaceRepository {
  return {
    getSnapshot: () => apiGet<Database>(endpoints.workspace),
    getInitialSnapshot: () => null,

    addLead: (fields) => apiPost<Lead>(endpoints.leads.create, fields),
    setLeadStage: (leadId, stage) =>
      apiPatch<Lead | null>(endpoints.leads.stage(leadId), { stage }),
    addLeadNote: (leadId, text, actorId) =>
      apiPost<Lead | null>(endpoints.leads.notes(leadId), { text, by: actorId }),
    setAppointment: (leadId, isoDate) =>
      apiPut<Lead | null>(endpoints.leads.appointment(leadId), { appointmentAt: isoDate }),

    saveProduct: (fields) =>
      fields.id
        ? apiPut<Product>(endpoints.products.detail(fields.id), fields)
        : apiPost<Product>(endpoints.products.create, fields),
    setProductCommission: (productId, rate) =>
      apiPatch<Product | null>(endpoints.products.commission(productId), { commissionRate: rate }),
    toggleProduct: (productId) => apiPatch<Product | null>(endpoints.products.toggle(productId)),

    saveUser: (fields) =>
      fields.id
        ? apiPut<User>(endpoints.users.detail(fields.id), fields)
        : apiPost<User>(endpoints.users.create, fields),
    removeUser: (userId) => apiDelete<boolean>(endpoints.users.detail(userId)),

    saveEstimate: (fields) =>
      fields.id
        ? apiPut<Estimate>(endpoints.estimates.detail(fields.id), fields)
        : apiPost<Estimate>(endpoints.estimates.create, fields),
    sendEstimate: (estimateId) => apiPost<Estimate | null>(endpoints.estimates.send(estimateId)),
    markEstimateViewed: (estimateId) =>
      apiPost<Estimate | null>(endpoints.estimates.viewed(estimateId)),
    signEstimate: (estimateId, typedName, tier) =>
      apiPost<{ estimate: Estimate; job: Job; invoice: Invoice } | null>(
        endpoints.estimates.sign(estimateId),
        { signedByName: typedName, tier },
      ),

    setJobStage: (jobId, stage) => apiPatch<Job | null>(endpoints.jobs.stage(jobId), { stage }),
    assignInstaller: (jobId, installerId, isoDate) =>
      apiPatch<Job | null>(endpoints.jobs.assignment(jobId), { installerId, scheduledDate: isoDate }),
    setMaterialsReceived: (jobId, value) =>
      apiPatch<Job | null>(endpoints.jobs.materials(jobId), { materialsReceived: value }),
    addJobPhoto: (jobId, label, name) =>
      apiPost<Job | null>(endpoints.jobs.photos(jobId), { label, name }),
    confirmJob: (jobId) => apiPost<Job | null>(endpoints.jobs.confirm(jobId)),

    setPaymentStatus: (invoiceId, status) =>
      apiPatch<Invoice | null>(endpoints.invoices.payment(invoiceId), { paymentStatus: status }),

    resetDemoData: () => apiPost<void>(endpoints.demo.reset),
    clearSyncLog: () => apiDelete<void>(endpoints.sync.log),
    simulateInboundEvent: () => apiPost<SyncEntry | void>(endpoints.sync.simulateInbound),
  };
}

/* ------------------------------------------------------------- the choice */

let instance: WorkspaceRepository | null = null;

/** The repository the app is running against. Built once, on first use. */
export function getRepository(): WorkspaceRepository {
  if (!instance) {
    instance = USE_MOCK_API ? createMockRepository() : createHttpRepository();
  }
  return instance;
}
