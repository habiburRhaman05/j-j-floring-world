/* ==========================================================================
   types.ts  -  the shapes the sales dashboards and /api/sales share
   Everything except the rates originates in GoHighLevel's "Sales Pipeline".
   ========================================================================== */

import type { CsrBoardOpportunity, CsrBoardPipeline } from "@/lib/csr/types";

export type OpportunityStatus = "open" | "won" | "lost" | "abandoned";

export interface SalesOpportunity extends CsrBoardOpportunity {
  /** GHL user the deal counts for: opportunity owner, else the contact's assignee, else first follower. */
  assignedToGhlId: string | null;
  /** The app user behind that GHL user, when there is one. */
  ownerUserId: string | null;
  /** Owner's display name: app user, else GHL user, else "Unassigned". */
  ownerName: string;
  /** When a won/lost/abandoned deal closed (GHL's last status change). */
  closedAt: string | null;
  updatedAt: string | null;
  source: string | null;
}

export interface SalesRep {
  userId: string;
  name: string;
  ghlUserId: string | null;
}

export interface SalesAssignedContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  tags: string[];
  dateAdded: string | null;
  ownerUserId: string | null;
  ownerName: string;
}

/**
 * Commission and margin inputs. GHL stores only the sale value, so margin is
 * an estimate from the company's average gross margin; commission is a
 * percent of won revenue, per rep when set, else the default.
 */
export interface SalesRates {
  defaultCommissionPercent: number;
  /** Company-average gross margin on won revenue. Admin only; null for reps. */
  marginPercent: number | null;
  /** userId -> commission percent. A rep only ever receives their own. */
  repCommissionPercent: Record<string, number>;
}

export interface SalesBoardResponse {
  scope: "all" | "own";
  locationId: string;
  pipeline: CsrBoardPipeline;
  reps: SalesRep[];
  opportunities: SalesOpportunity[];
  /** Contacts assigned to a rep in GHL that have no opportunity in the Sales Pipeline yet. */
  assignedContacts: SalesAssignedContact[];
  rates: SalesRates;
  /** Set when a rep's account is not linked to a GHL user, so nothing can be matched. */
  notice: string | null;
}
