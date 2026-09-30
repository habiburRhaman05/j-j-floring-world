export type InvoiceDisplayStatus = "Draft" | "Sent" | "Partially paid" | "Paid" | "Overdue" | "Void";

export interface InvoiceListItem {
  id: string;
  number: string;
  customerName: string;
  repName: string | null;
  estimateNumber: string | null;
  status: InvoiceDisplayStatus;
  total: number;
  amountPaid: number;
  amountDue: number;
  issuedAt: string | null;
  dueAt: string | null;
  /** The customer-facing GHL invoice page, when GHL gave one. */
  url: string | null;
}

export interface InvoiceListResponse {
  scope: "all" | "own";
  invoices: InvoiceListItem[];
  /** Set when GHL could not be reached and the saved copy is shown instead. */
  notice: string | null;
}
