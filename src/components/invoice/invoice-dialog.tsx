"use client";

import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StagePill } from "@/components/ui/pill";
import { useSetPaymentStatus } from "@/lib/data/hooks";
import type { Database, Invoice, PaymentStatus, Role } from "@/lib/types";
import { can } from "@/lib/auth/permissions";
import { dt, money2 } from "@/lib/format";
import { InvoiceSummary, LineTable } from "./line-table";

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  db: Database;
  role: Role;
}

const PAYMENT_STATES: PaymentStatus[] = ["Unpaid", "Partial", "Paid"];

export function InvoiceDialog({ open, onOpenChange, invoice, db, role }: InvoiceDialogProps) {
  const showCost = can.viewCost(role);
  const setPaymentStatus = useSetPaymentStatus();
  const { toast } = useToast();

  const lead = db.leads.find((l) => l.id === invoice.leadId);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Invoice ${invoice.id}`}
      subtitle={`Created ${dt(invoice.createdAt)}`}
      wide
      actions={[{ label: "Close", variant: "ghost" }]}
    >
      <div className="spread" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{lead ? lead.name : invoice.leadId}</div>
          <div className="t-meta">
            {lead ? lead.address : ""}, {invoice.tier} tier
          </div>
        </div>
        <StagePill stage={invoice.paymentStatus} />
      </div>

      <LineTable db={db} lineItems={invoice.lineItems} showCost={showCost} />

      <hr className="divider" />

      <InvoiceSummary
        totalPrice={invoice.totalPrice}
        totalCost={invoice.totalCost}
        totalMargin={invoice.totalMargin}
        depositPercent={invoice.depositPercent}
        depositAmount={invoice.depositAmount}
        depositPaid={invoice.depositPaid}
        balanceAmount={invoice.balanceAmount}
        showCost={showCost}
      />

      {showCost ? (
        <>
          <hr className="divider" />
          <div className="label">Payment</div>
          <div className="row-wrap">
            {PAYMENT_STATES.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={invoice.paymentStatus === status ? "primary" : "default"}
                onClick={() => {
                  setPaymentStatus.mutate([invoice.id, status]);
                  toast(`Invoice marked ${status}.`, status === "Paid" ? "ok" : "");
                }}
              >
                Mark {status}
              </Button>
            ))}
          </div>
        </>
      ) : null}

      <span className="sr-only">
        Balance {money2(invoice.balanceAmount)} on invoice {invoice.id}
      </span>
    </Modal>
  );
}
