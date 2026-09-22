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
    },
  },

  /** The whole workspace in one payload. */
  workspace: "/workspace",

  leads: {
    list: "/leads",
    create: "/leads",
    detail: (leadId: string) => `/leads/${leadId}`,
    stage: (leadId: string) => `/leads/${leadId}/stage`,
    notes: (leadId: string) => `/leads/${leadId}/notes`,
    appointment: (leadId: string) => `/leads/${leadId}/appointment`,
  },

  products: {
    list: "/products",
    create: "/products",
    detail: (productId: string) => `/products/${productId}`,
    commission: (productId: string) => `/products/${productId}/commission`,
    toggle: (productId: string) => `/products/${productId}/active`,
  },

  users: {
    list: "/api/users",
    create: "/api/users",
    detail: (userId: string) => `/api/users/${userId}`,
    suspend: (userId: string) => `/api/users/${userId}/suspend`,
    reactivate: (userId: string) => `/api/users/${userId}/reactivate`,
  },

  estimates: {
    list: "/estimates",
    create: "/estimates",
    detail: (estimateId: string) => `/estimates/${estimateId}`,
    send: (estimateId: string) => `/estimates/${estimateId}/send`,
    viewed: (estimateId: string) => `/estimates/${estimateId}/viewed`,
    sign: (estimateId: string) => `/estimates/${estimateId}/sign`,
  },

  jobs: {
    list: "/jobs",
    detail: (jobId: string) => `/jobs/${jobId}`,
    stage: (jobId: string) => `/jobs/${jobId}/stage`,
    assignment: (jobId: string) => `/jobs/${jobId}/assignment`,
    materials: (jobId: string) => `/jobs/${jobId}/materials`,
    photos: (jobId: string) => `/jobs/${jobId}/photos`,
    confirm: (jobId: string) => `/jobs/${jobId}/confirm`,
  },

  invoices: {
    list: "/invoices",
    payment: (invoiceId: string) => `/invoices/${invoiceId}/payment`,
  },

  sync: {
    log: "/sync/log",
    simulateInbound: "/sync/simulate-inbound",
  },

  demo: {
    reset: "/demo/reset",
  },
} as const;
