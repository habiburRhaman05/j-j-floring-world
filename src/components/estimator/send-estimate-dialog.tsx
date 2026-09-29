"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Modal } from "@/components/ui/modal";
import { TIERS } from "@/lib/constants";
import { useSendEstimate } from "@/lib/data/hooks";
import { estimateTierTotals } from "@/lib/data/pricing";
import { money2 } from "@/lib/format";
import type { Estimate } from "@/lib/types";

interface SendEstimateDialogProps {
  estimate: Estimate;
  onClose: () => void;
  /** Called once the send has been confirmed. */
  onSent?: () => void;
}

/**
 * Confirmation before sending: shows which packages will go out and who
 * receives them. All non-empty packages are sent so the customer can compare.
 */
export function SendEstimateDialog({ estimate, onClose, onSent }: SendEstimateDialogProps) {
  const send = useSendEstimate();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const available = TIERS.filter((t) => estimate.tiers[t].length > 0);

  const customer = estimate.customer;
  const email = customer?.email?.trim() ?? "";
  const resend = estimate.status === "Sent" || estimate.status === "Viewed";

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title={resend ? "Send the estimate again" : "Send estimate for approval"}
      subtitle={`${estimate.number}${customer?.name ? ` for ${customer.name}` : ""}`}
      actions={[
        { label: "Cancel", variant: "ghost" },
        {
          label: `Send ${available.length} package${available.length === 1 ? "" : "s"}`,
          variant: "primary",
          keep: true,
          onClick: async (close) => {
            if (available.length === 0) {
              toast("Add at least one line to a package first.", "warn");
              return false;
            }
            if (!email) {               toast("This customer has no email address on file.", "warn");
              return false;
            }
            try {
              const sent = (await send.mutateAsync([estimate.id])) as { warning?: string | null } | null;
              if (sent?.warning) toast(sent.warning, "warn", 6000);
              else toast(`Sent. Waiting for ${customer?.name || "the customer"} to sign.`, "ok", 4200);
            } catch {
              return false;
            }
            onSent?.();
            close();
          },
        },
      ]}
    >
      <div className="label">Packages included in this estimate</div>
      <div className="send-tiers">
        {TIERS.map((t) => {
          const lines = estimate.tiers[t];
          const empty = lines.length === 0;
          const totals = estimateTierTotals(lines, estimate.tierMeta[t], estimate.taxRate);
          return (
            <div key={t} className={`send-tier${empty ? " disabled" : " active"}`}>
              <span className="grow">
                <strong>{estimate.tierMeta[t].label || t}</strong>
                <span className="t-meta" style={{ display: "block" }}>
                  {empty ? "No lines - not included" : `${lines.length} line${lines.length === 1 ? "" : "s"}`}
                </span>
              </span>
              <span className="t-num">{empty ? "-" : money2(totals.totalPrice)}</span>
            </div>
          );
        })}
      </div>

      <div className="send-note" role="note">
        {email ? (
          <>
            Your workspace will email <strong>{customer?.name}</strong> at <strong>{email}</strong> a document
            with {available.length === 1 ? "this package" : `all ${available.length} packages`} to review
            and sign. The estimate then shows <strong>Waiting for approval</strong> until they sign it.
          </>
        ) : (
          <>
            This customer has <strong>no email address</strong> on file, so the document can&apos;t
            be sent. Add one to the contact record first.
          </>
        )}
      </div>
      {resend ? (
        <div className="t-meta" style={{ marginTop: 8 }}>
          This estimate was already sent. Sending again emails a new document, and only the new one counts
          as the approval.
        </div>
      ) : null}
    </Modal>
  );
}
