/* ==========================================================================
   endpoints.ts  -  every path the app calls, in one place
   --------------------------------------------------------------------------
   Keeping the routes here means the backend team can read one file to see the
   whole contract, and a path change is a one-line edit rather than a search.
   ========================================================================== */

export const endpoints = {
  // Auth, account and settings are served by this same Next.js app's own
  // Route Handlers under app/api/**, so these live at /api - unlike the
  // groups below, which still point at a not-yet-built separate backend and
  // are only exercised through the mock repository today.
  auth: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    session: "/api/auth/session",
    forgotPassword: "/api/auth/forgot-password",
    resetPassword: "/api/auth/reset-password",
    acceptInvitation: "/api/auth/accept-invitation",
  },

  account: {
    get: "/api/account",
    update: "/api/account",
    password: "/api/account/password",
    avatar: "/api/account/avatar",
  },

  settings: {
    ghl: {
      get: "/api/settings/integrations/ghl",
      save: "/api/settings/integrations/ghl",
      test: "/api/settings/integrations/ghl/test",
      leadConfig: "/api/settings/integrations/ghl/lead-config",
      pipelines: "/api/settings/integrations/ghl/pipelines",
      tagCheck: (tag: string) => `/api/settings/integrations/ghl/tag-check?tag=${encodeURIComponent(tag)}`,
    },
  },

  /** The whole workspace in one payload. */
  workspace: "/api/workspace",

  leads: {
    list: "/api/leads",
    create: "/api/leads",
    detail: (leadId: string) => `/api/leads/${leadId}`,
    stage: (leadId: string) => `/api/leads/${leadId}/stage`,
    notes: (leadId: string) => `/api/leads/${leadId}/notes`,
    appointment: (leadId: string) => `/api/leads/${leadId}/appointment`,
  },

  products: {
    list: "/api/products",
    create: "/api/products",
    detail: (productId: string) => `/api/products/${productId}`,
    commission: (productId: string) => `/api/products/${productId}/commission`,
    toggle: (productId: string) => `/api/products/${productId}/active`,
  },

  users: {
    list: "/api/users",
    create: "/api/users",
    detail: (userId: string) => `/api/users/${userId}`,
    suspend: (userId: string) => `/api/users/${userId}/suspend`,
    reactivate: (userId: string) => `/api/users/${userId}/reactivate`,
  },

  estimates: {
    list: "/api/estimates",
    create: "/api/estimates",
    detail: (estimateId: string) => `/api/estimates/${estimateId}`,
    send: (estimateId: string) => `/api/estimates/${estimateId}/send`,
    viewed: (estimateId: string) => `/api/estimates/${estimateId}/viewed`,
    sign: (estimateId: string) => `/api/estimates/${estimateId}/sign`,
  },

  jobs: {
    list: "/api/jobs",
    detail: (jobId: string) => `/api/jobs/${jobId}`,
    stage: (jobId: string) => `/api/jobs/${jobId}/stage`,
    assignment: (jobId: string) => `/api/jobs/${jobId}/assignment`,
    materials: (jobId: string) => `/api/jobs/${jobId}/materials`,
    photos: (jobId: string) => `/api/jobs/${jobId}/photos`,
    confirm: (jobId: string) => `/api/jobs/${jobId}/confirm`,
  },

  invoices: {
    list: "/api/invoices",
    payment: (invoiceId: string) => `/api/invoices/${invoiceId}/payment`,
  },

  sync: {
    log: "/api/sync/log",
    simulateInbound: "/api/sync/simulate-inbound",
  },

  demo: {
    reset: "/api/demo/reset",
  },
} as const;
