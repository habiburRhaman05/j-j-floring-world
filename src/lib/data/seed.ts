/* ==========================================================================
   seed.ts  -  the demo data set
   A faithful port of the prototype's seed. In this frontend-first build the
   seed is plain in-memory data; when the API lands it becomes the shape the
   server returns rather than something the client owns.
   ========================================================================== */

import { DEFAULT_COMMISSION_RATE } from "../constants";
import type {
  Database,
  Estimate,
  Invoice,
  Job,
  JobStage,
  Lead,
  LeadSource,
  LineItem,
  Product,
  ProductCategory,
  Role,
  SyncEntry,
  Tier,
  Unit,
  User,
} from "../types";
import { byId, totalsFor } from "./pricing";
import { round2 } from "../format";

let seq = 0;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 30, 0, 0);
  return d.toISOString();
}

function daysAhead(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

/**
 * The team, with the sign-in identity each row uses. Emails are unique and
 * matched case-insensitively; the demo password for every seeded account is in
 * lib/auth/credentials.ts.
 */
function seedUsers(): User[] {
  const rows: Array<[string, string, string, Role, number]> = [
    ["u_admin", "Janet Ross", "janet.ross@jjflooringworld.com", "Admin", 0],
    ["u_rep_a", "Marcus Hale", "marcus.hale@jjflooringworld.com", "Sales Rep", 0.06],
    ["u_rep_b", "Dana Whitfield", "dana.whitfield@jjflooringworld.com", "Sales Rep", 0.055],
    ["u_csr", "Priya Nair", "priya.nair@jjflooringworld.com", "CSR", 0],
    ["u_inst_1", "Tony Alvarez", "tony.alvarez@jjflooringworld.com", "Installer", 0],
    ["u_inst_2", "Rick Boone", "rick.boone@jjflooringworld.com", "Installer", 0],
  ];
  return rows.map(([id, name, email, role, commissionRate]) => ({
    id,
    name,
    email,
    role,
    commissionRate,
  }));
}

/**
 * The catalog mirrors what the company actually sells, so a rep quoting a job
 * is picking from the same list a customer sees on the website. The first
 * seven rows carry the Good / Better / Best tier markers.
 *
 * Rows 1 to 23 keep their original positions on purpose: the seeded estimates
 * reference them by id, so the demo still tells a coherent story after a
 * rename. Rows 24 onward are the remaining site lines.
 *
 * The last column is the commission the line earns. Finishing materials carry
 * their own rate because that is where the money is; consumables, tear-out,
 * trim and labour leave it null so they pay the rep's standard rate, which is
 * how the fallback chain gets exercised in the demo.
 */
type ProductRow = [string, ProductCategory, Unit, number, number, Tier | null, number | null];

function seedProducts(): Product[] {
  const rows: ProductRow[] = [
    ["Luxury Vinyl Plank, Traditional 4mm", "Luxury Vinyl Plank", "SF", 2.18, 4.45, "Good", 0.08],
    ["Luxury Vinyl Plank, Waterproof 6mm", "Luxury Vinyl Plank", "SF", 2.74, 5.6, "Better", 0.09],
    ["Luxury Vinyl Plank, Rigid Core 8mm", "Luxury Vinyl Plank", "SF", 3.62, 7.25, "Best", 0.1],
    ["Laminate, 8mm Water Resistant", "Laminate", "SF", 2.05, 4.1, "Good", 0.07],
    ["Carpet, Plush Polyester", "Carpet", "YD", 14.2, 27.5, "Good", 0.07],
    ["Carpet, Stain-Resistant Nylon", "Carpet", "YD", 18.9, 36.0, "Better", 0.08],
    ["Carpet, Textured Wool Blend", "Carpet", "YD", 27.4, 52.0, "Best", 0.09],
    ["8lb Rebond Carpet Pad", "Underlayment", "YD", 3.1, 6.25, null, null],
    ["Plank Underlayment, Vapor Barrier", "Underlayment", "SF", 0.42, 0.95, null, null],
    ["Stair Tread Wrap, Stained Oak", "Stairs", "EA", 38.0, 96.0, null, 0.06],
    ["Stair Riser Cover, Painted", "Stairs", "EA", 12.5, 34.0, null, null],
    ["Carpet Stair Install, Per Step", "Stairs", "EA", 14.0, 38.0, null, null],
    ["Tear-Out and Haul, Carpet", "Removal & Prep", "SF", 0.38, 0.95, null, null],
    ["Tear-Out and Haul, Glue-Down", "Removal & Prep", "SF", 0.72, 1.85, null, null],
    ["Floor Prep and Level, Skim Coat", "Removal & Prep", "SF", 0.55, 1.4, null, null],
    ["T-Molding Transition", "Transitions", "LF", 3.4, 8.5, null, null],
    ["Reducer Strip", "Transitions", "LF", 3.1, 7.9, null, null],
    ["Quarter Round, Primed", "Trim", "LF", 0.85, 2.6, null, null],
    ["Baseboard 3-1/4in, Primed MDF", "Trim", "LF", 1.4, 4.2, null, null],
    ["Pressure Sensitive Adhesive, 4gal", "Adhesive", "EA", 62.0, 118.0, null, null],
    ["Flooring Installation Labor", "Labor", "SF", 1.15, 2.85, null, null],
    ["Carpet Installation Labor", "Labor", "YD", 4.2, 9.5, null, null],
    ["Furniture Move, Per Room", "Labor", "EA", 22.0, 65.0, null, null],
    ["Carpet Tile, Peel and Stick 20x20", "Carpet Tile", "SF", 1.45, 3.2, null, 0.07],
    ["Commercial Carpet Tile, 24x24", "Carpet Tile", "SF", 1.85, 4.2, null, 0.08],
    ["Solid Hardwood, Oak 3/4in", "Hardwood", "SF", 4.1, 8.9, null, 0.06],
    ["Engineered Hardwood, Hickory", "Hardwood", "SF", 3.35, 7.4, null, 0.06],
    ["Hardwood Refinishing, Sand and Finish", "Refinishing", "SF", 1.2, 3.1, null, 0.1],
    ["Sheet Vinyl, Roll Goods", "Sheet Vinyl", "SF", 1.05, 2.55, null, 0.07],
    ["Vinyl Floor Tile, Glue-Down", "Vinyl Tile", "SF", 1.6, 3.75, null, 0.07],
    ["Laminate Stairs, Per Step", "Stairs", "EA", 14.0, 38.0, null, null],
    ["Vinyl Stairs, Per Step", "Stairs", "EA", 12.5, 34.0, null, null],
  ];
  return rows.map(([name, category, unit, costPerUnit, pricePerUnit, tier, commissionRate], i) => ({
    id: `prod_${i + 1}`,
    name,
    category,
    unit,
    costPerUnit,
    pricePerUnit,
    tier,
    commissionRate,
    active: true,
  }));
}

type LeadRow = [
  string, // name
  string, // phone
  string, // email
  string, // zip
  string, // address
  LeadSource,
  string, // rep id
  Lead["stage"],
  number, // days ago
  string, // note
];

function seedLeads(): Lead[] {
  const rows: LeadRow[] = [
    ["Eleanor Whitcomb", "(704) 555-0182", "e.whitcomb@example.com", "28202", "1140 Sycamore Ln, Charlotte, NC", "Facebook Ads", "u_rep_a", "Won", 2, "Whole main floor LVP, wants Best tier finish."],
    ["Darnell Pierce", "(704) 555-0119", "dpierce@example.com", "28216", "308 Kestrel Ct, Charlotte, NC", "Website Form", "u_rep_a", "Won", 9, "Stairs plus upstairs carpet. Referral from neighbor."],
    ["Sofia Martinelli", "(803) 555-0143", "sofiam@example.com", "29708", "44 Waxhaw Trace, Fort Mill, SC", "Facebook Ads", "u_rep_b", "Won", 16, "Basement LVP over concrete, needed leveling."],
    ["Grant Ferraro", "(704) 555-0177", "gferraro@example.com", "28277", "9021 Ballantyne Commons, Charlotte", "Website Form", "u_rep_b", "Estimate Sent", 3, "Sent Good/Better/Best Tuesday. Comparing with one other bid."],
    ["Renata Cole", "(704) 555-0155", "renata.cole@example.com", "28105", "712 Matthews Township Pkwy, Matthews", "Other", "u_rep_a", "Follow-Up", 6, "Liked Better tier, waiting on spouse."],
    ["Micah Bledsoe", "(704) 555-0190", "mbledsoe@example.com", "28078", "15 Northcross Dr, Huntersville, NC", "Facebook Ads", "u_rep_b", "Appointment Set", 1, "Measure appointment booked, wants carpet in 3 bedrooms."],
    ["Yvonne Adebayo", "(704) 555-0133", "yadebayo@example.com", "28269", "2204 Prosperity Ridge, Charlotte", "Website Form", "u_rep_a", "Qualified", 2, "Budget confirmed around 9k. Needs weekend install."],
    ["Tomas Vidal", "(803) 555-0166", "tvidal@example.com", "29715", "881 Springfield Pkwy, Fort Mill, SC", "Facebook Ads", "u_rep_b", "Contacted", 1, "Left voicemail, texted back asking for pricing range."],
    ["Harriet Okonkwo", "(704) 555-0121", "hokonkwo@example.com", "28211", "3317 Providence Rd, Charlotte, NC", "Website Form", "u_rep_a", "New Lead", 0, "Form says kitchen and hallway, approx 480 SF."],
    ["Bryce Lindqvist", "(704) 555-0104", "blind@example.com", "28203", "520 South Blvd, Charlotte, NC", "Other", "u_rep_b", "New Lead", 0, "Walk-in at showroom. Condo, HOA sound rules apply."],
    ["Priscilla Hahn", "(704) 555-0198", "phahn@example.com", "28226", "6605 Carmel Rd, Charlotte, NC", "Facebook Ads", "u_rep_a", "Lost", 21, "Went with a big box retailer on price."],
  ];
  return rows.map(
    ([name, phone, email, zipCode, address, source, assignedRepId, stage, ago, note], i) => ({
      id: `lead_${i + 1}`,
      name,
      phone,
      email,
      zipCode,
      address,
      source,
      assignedRepId,
      stage,
      createdAt: daysAgo(ago + 4),
      appointmentAt: stage === "Appointment Set" ? daysAhead(2) : null,
      notes: [{ at: daysAgo(ago), by: "u_csr", text: note }],
    }),
  );
}

/** Build a line item list from [productId, qty] pairs. */
function li(pairs: Array<[string, number]>): LineItem[] {
  return pairs.map(([productId, qty]) => ({ productId, qty }));
}

function seedEstimates(): Estimate[] {
  return [
    {
      id: "est_1",
      leadId: "lead_1",
      repId: "u_rep_a",
      createdAt: daysAgo(14),
      status: "Signed",
      signedAt: daysAgo(12),
      signedByName: "Eleanor Whitcomb",
      depositPercent: 35,
      acceptedTier: "Best",
      tiers: {
        Good: li([["prod_1", 1180], ["prod_21", 1180], ["prod_13", 1180], ["prod_18", 210]]),
        Better: li([["prod_2", 1180], ["prod_21", 1180], ["prod_13", 1180], ["prod_18", 210], ["prod_16", 34]]),
        Best: li([["prod_3", 1180], ["prod_21", 1180], ["prod_13", 1180], ["prod_15", 1180], ["prod_19", 210], ["prod_16", 34]]),
      },
    },
    {
      id: "est_2",
      leadId: "lead_2",
      repId: "u_rep_a",
      createdAt: daysAgo(11),
      status: "Signed",
      signedAt: daysAgo(10),
      signedByName: "Darnell Pierce",
      depositPercent: 30,
      acceptedTier: "Better",
      tiers: {
        Good: li([["prod_5", 96], ["prod_8", 96], ["prod_22", 96], ["prod_12", 14]]),
        Better: li([["prod_6", 96], ["prod_8", 96], ["prod_22", 96], ["prod_12", 14], ["prod_13", 860]]),
        Best: li([["prod_7", 96], ["prod_8", 96], ["prod_22", 96], ["prod_10", 14], ["prod_11", 14], ["prod_13", 860]]),
      },
    },
    {
      id: "est_3",
      leadId: "lead_3",
      repId: "u_rep_b",
      createdAt: daysAgo(19),
      status: "Signed",
      signedAt: daysAgo(18),
      signedByName: "Sofia Martinelli",
      depositPercent: 35,
      acceptedTier: "Good",
      tiers: {
        Good: li([["prod_1", 720], ["prod_21", 720], ["prod_15", 720], ["prod_18", 140]]),
        Better: li([["prod_2", 720], ["prod_21", 720], ["prod_15", 720], ["prod_9", 720], ["prod_18", 140]]),
        Best: li([["prod_3", 720], ["prod_21", 720], ["prod_15", 720], ["prod_9", 720], ["prod_19", 140], ["prod_17", 22]]),
      },
    },
    {
      id: "est_4",
      leadId: "lead_4",
      repId: "u_rep_b",
      createdAt: daysAgo(3),
      status: "Sent",
      signedAt: null,
      signedByName: null,
      depositPercent: 30,
      acceptedTier: null,
      tiers: {
        Good: li([["prod_4", 940], ["prod_21", 940], ["prod_13", 940]]),
        Better: li([["prod_2", 940], ["prod_21", 940], ["prod_13", 940], ["prod_16", 28]]),
        Best: li([["prod_3", 940], ["prod_21", 940], ["prod_14", 940], ["prod_15", 940], ["prod_16", 28]]),
      },
    },
    {
      id: "est_5",
      leadId: "lead_5",
      repId: "u_rep_a",
      createdAt: daysAgo(6),
      status: "Viewed",
      signedAt: null,
      signedByName: null,
      depositPercent: 30,
      acceptedTier: null,
      tiers: {
        Good: li([["prod_5", 62], ["prod_8", 62], ["prod_22", 62]]),
        Better: li([["prod_6", 62], ["prod_8", 62], ["prod_22", 62], ["prod_23", 3]]),
        Best: li([["prod_7", 62], ["prod_8", 62], ["prod_22", 62], ["prod_23", 3], ["prod_13", 560]]),
      },
    },
  ];
}

function seedJobs(): Job[] {
  return [
    {
      id: "job_1",
      leadId: "lead_1",
      estimateId: "est_1",
      stage: "Scheduled" as JobStage,
      scheduledDate: daysAhead(3),
      installerId: "u_inst_1",
      materialsReceived: true,
      photos: [],
      completedAt: null,
      adminConfirmedAt: null,
      createdAt: daysAgo(12),
    },
    {
      id: "job_2",
      leadId: "lead_2",
      estimateId: "est_2",
      stage: "In Progress" as JobStage,
      scheduledDate: daysAhead(0),
      installerId: "u_inst_1",
      materialsReceived: true,
      photos: [{ id: "ph_1", label: "Before", name: "before-stairs.jpg", at: daysAgo(0) }],
      completedAt: null,
      adminConfirmedAt: null,
      createdAt: daysAgo(10),
    },
    {
      id: "job_3",
      leadId: "lead_3",
      estimateId: "est_3",
      stage: "Completed" as JobStage,
      scheduledDate: daysAgo(4),
      installerId: "u_inst_2",
      materialsReceived: true,
      photos: [
        { id: "ph_2", label: "Before", name: "before-basement.jpg", at: daysAgo(4) },
        { id: "ph_3", label: "Completion", name: "after-basement.jpg", at: daysAgo(4) },
      ],
      completedAt: daysAgo(4),
      adminConfirmedAt: daysAgo(3),
      createdAt: daysAgo(18),
    },
  ];
}

function seedInvoices(db: Database): Invoice[] {
  const out: Invoice[] = [];
  for (const job of db.jobs) {
    const est = byId(db.estimates, job.estimateId);
    if (!est) continue;
    const tier: Tier = est.acceptedTier ?? "Better";
    const t = totalsFor(db.products, est.tiers[tier]);
    const deposit = round2(t.totalPrice * (est.depositPercent / 100));
    const paidInFull = job.stage === "Completed";
    out.push({
      id: `inv_${out.length + 1}`,
      jobId: job.id,
      estimateId: est.id,
      leadId: job.leadId,
      repId: est.repId,
      tier,
      lineItems: est.tiers[tier],
      totalPrice: t.totalPrice,
      totalCost: t.totalCost,
      totalMargin: t.totalMargin,
      depositPercent: est.depositPercent,
      depositAmount: deposit,
      depositPaid: true,
      balanceAmount: round2(t.totalPrice - deposit),
      paymentStatus: paidInFull ? "Paid" : "Partial",
      paidAt: paidInFull ? job.completedAt : null,
      createdAt: job.createdAt,
    });
  }
  return out;
}

function seedSyncLog(): SyncEntry[] {
  const rows: Array<[number, "in" | "out", string, string]> = [
    [12, "out", "opportunity.stage", "App → GHL: Opportunity 'Eleanor Whitcomb' moved to 'Won'"],
    [10, "out", "job.created", "App → GHL: Job created for 'Darnell Pierce', pipeline 'Installation'"],
    [9, "in", "contact.updated", "GHL → App: Contact 'Tomas Vidal' phone updated"],
    [4, "out", "job.stage", "App → GHL: Job 'Sofia Martinelli' moved to 'Completed'"],
  ];
  return rows.map(([ago, dir, event, message]) => ({
    id: uid("sync"),
    at: daysAgo(ago),
    dir,
    event,
    message,
  }));
}

/** Build a clean, fully seeded database. */
export function buildSeed(): Database {
  const db: Database = {
    version: 3,
    seededAt: new Date().toISOString(),
    settings: { defaultCommissionRate: DEFAULT_COMMISSION_RATE },
    users: seedUsers(),
    products: seedProducts(),
    leads: seedLeads(),
    estimates: seedEstimates(),
    jobs: seedJobs(),
    invoices: [],
    syncLog: [],
  };
  db.invoices = seedInvoices(db);
  db.syncLog = seedSyncLog();
  return db;
}

export { daysAgo, daysAhead };
