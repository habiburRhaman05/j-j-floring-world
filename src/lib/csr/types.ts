/* ==========================================================================
   types.ts  -  the shapes the CSR dashboard and its API routes share
   Plain data only, so both the server mapper and the client hooks can import
   it. Everything here originates in GoHighLevel.
   ========================================================================== */

export interface CsrBoardStage {
  id: string;
  name: string;
}

export interface CsrBoardPipeline {
  id: string;
  name: string;
  /** In the order GHL shows them, left to right. */
  stages: CsrBoardStage[];
}

export interface CsrPipelinesResponse {
  locationId: string;
  /** lead-qualify when it exists. */
  defaultPipelineId: string | null;
  pipelines: CsrBoardPipeline[];
}

export interface CsrBoardOpportunity {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  phone: string;
  email: string;
  tags: string[];
  stageId: string;
  status: string;
  /** Dollars. 0 when GHL has no value on the card. */
  value: number;
  createdAt: string | null;
}

export interface CsrOpportunitiesResponse {
  pipelineId: string;
  opportunities: CsrBoardOpportunity[];
}

export interface CsrFbLeadContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  tags: string[];
  city: string;
  postalCode: string;
  dateAdded: string | null;
}

export interface CsrFbLeadsResponse {
  tag: string;
  locationId: string;
  contacts: CsrFbLeadContact[];
}
