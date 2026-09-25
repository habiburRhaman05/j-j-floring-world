/* ==========================================================================
   constants.ts  -  pipeline stages, catalog enums and shared vocabularies
   These lists drive both the UI and the seed data, so they are declared once
   here rather than repeated across views.
   ========================================================================== */

export const SALES_STAGES = [
  "New Lead",
  "Contacted",
  "Qualified",
  "Appointment Set",
  "Estimate Sent",
  "Follow-Up",
  "Won",
  "Lost",
] as const;

/**
 * The Installation phase carries two sub-states, flattened here so a job
 * always has exactly one current stage; JOB_PHASES groups them for display.
 */
export const JOB_STAGES = [
  "Deposit Paid",
  "Materials Ordered",
  "Ready to Schedule",
  "Scheduled",
  "En Route",
  "In Progress",
  "Completed",
] as const;

export const JOB_PHASES: ReadonlyArray<{ label: string; stages: readonly string[] }> = [
  { label: "Deposit Paid", stages: ["Deposit Paid"] },
  { label: "Materials Ordered", stages: ["Materials Ordered"] },
  { label: "Ready to Schedule", stages: ["Ready to Schedule"] },
  { label: "Scheduled", stages: ["Scheduled"] },
  { label: "Installation", stages: ["En Route", "In Progress"] },
  { label: "Completed", stages: ["Completed"] },
];

/** A CSR can only move a lead through the intake part of the pipeline. */
export const CSR_STAGES = ["New Lead", "Contacted", "Appointment Set"] as const;

/**
 * Categories follow the product lines the company actually sells on its own
 * site (jjflooringworld.com), plus the job lines every install carries.
 */
export const PRODUCT_CATEGORIES = [
  "Carpet",
  "Carpet Tile",
  "Hardwood",
  "Refinishing",
  "Luxury Vinyl Plank",
  "Laminate",
  "Sheet Vinyl",
  "Vinyl Tile",
  "Stairs",
  "Removal & Prep",
  "Underlayment",
  "Transitions",
  "Trim",
  "Adhesive",
  "Labor",
] as const;

export const UNITS = ["SF", "YD", "LF", "EA", "HR", "GAL", "BOX"] as const;
export const TIERS = ["Good", "Better", "Best"] as const;
export const LEAD_SOURCES = ["Facebook Ads", "Website Form", "Other"] as const;

/**
 * Commission policy, resolved in this order and never stored on a line:
 *   1. the product's own rate, when the product carries one
 *   2. the rep's rate
 *   3. this company default
 * Every commission figure is derived through that chain, so the rep's own
 * number and the office's earnings report can never drift apart.
 */
export const DEFAULT_COMMISSION_RATE = 0.06;

/** Which pill tone a stage or status paints in. */
export const STAGE_TONE: Record<string, string> = {
  "New Lead": "pill-slate",
  Contacted: "pill-slate",
  Qualified: "pill-oak",
  "Appointment Set": "pill-oak",
  "Estimate Sent": "pill-brass",
  "Follow-Up": "pill-brass",
  Won: "pill-moss",
  Lost: "pill-clay",
  "Deposit Paid": "pill-slate",
  "Materials Ordered": "pill-slate",
  "Ready to Schedule": "pill-oak",
  Scheduled: "pill-oak",
  "En Route": "pill-brass",
  "In Progress": "pill-brass",
  Completed: "pill-moss",
  Draft: "pill-outline",
  Sent: "pill-oak",
  Viewed: "pill-brass",
  Signed: "pill-moss",
  Expired: "pill-clay",
  Paid: "pill-moss",
  Partial: "pill-brass",
  Unpaid: "pill-clay",
};

/** Photo labels an installer can attach. */
export const PHOTO_LABELS = ["Before", "Progress", "Completion", "Issue"] as const;
