"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Modal } from "@/components/ui/modal";
import { TIERS } from "@/lib/constants";
import { useSendEstimate } from "@/lib/data/hooks";
import { estimateTierTotals } from "@/lib/data/pricing";
import { money2 } from "@/lib/format";
import type { Estimate, Tier } from "@/lib/types";

interface SendEstimateDialogProps {
  estimate: Estimate;
  onClose: () => void;
  /** Called once GoHighLevel has confirmed the document went out. */
  onSent?: () => void;
}

/**
 * The confirmation step before anything reaches a customer: which package
 * they are being asked to sign, and exactly who gets the email. The email is
 * sent by GoHighLevel from the business's own account, only when this
 * dialog's button is pressed, and never to someone who opted out.
 */
export function SendEstimateDialog({ estimate, onClose, onSent }: SendEstimateDialogProps) {
  const send = useSendEstimate();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const available = TIERS.filter((t) => estimate.tiers[t].length > 0);
  const [tier, setTier] = useState<Tier | null>(
    estimate.sentTier && available.includes(estimate.sentTier)
      ? estimate.sentTier
      : available.includes("Better")
        ? "Better"
        : (available[0] ?? null),
  );

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
          label: "Email to customer",
          variant: "primary",
          keep: true,
          onClick: async (close) => {
            if (!tier) {
              toast("Add at least one line to a package first.", "warn");
              return false;
            }
            if (!email) {
              toast("This customer has no email address in GoHighLevel.", "warn");
              return false;
            }
            try {
              const sent = (await send.mutateAsync([estimate.id, tier])) as { warning?: string | null } | null;
              if (sent?.warning) toast(sent.warning, "warn", 6000);
              else toast(`Sent. Waiting for ${customer?.name || "the customer"} to sign.`, "ok", 4200);
            } catch {
              // The mutation hook has already said why (opted out, GoHighLevel refused, ...).
              return false;
            }
            onSent?.();
            close();
          },
        },
      ]}
    >
      <div className="label">Which package should the customer approve?</div>
      <div className="send-tiers">
        {TIERS.map((t) => {
          const lines = estimate.tiers[t];
          const empty = lines.length === 0;
          const totals = estimateTierTotals(lines, estimate.tierMeta[t], estimate.taxRate);
          return (
            <label key={t} className={`send-tier${tier === t ? " active" : ""}${empty ? " disabled" : ""}`}>
              <input
                type="radio"
                name="send-tier"
                checked={tier === t}
                disabled={empty}
                onChange={() => setTier(t)}
              />
              <span className="grow">
                <strong>{estimate.tierMeta[t].label || t}</strong>
                <span className="t-meta" style={{ display: "block" }}>
                  {empty ? "No lines" : `${lines.length} line${lines.length === 1 ? "" : "s"}`}
                </span>
              </span>
              <span className="t-num">{empty ? "-" : money2(totals.totalPrice)}</span>
            </label>
          );
        })}
      </div>

      <div className="send-note" role="note">
        {email ? (
          <>
            GoHighLevel will email <strong>{customer?.name}</strong> at <strong>{email}</strong> a document
            to review and sign. The estimate then shows <strong>Waiting for approval</strong> until they
            sign it.
          </>
        ) : (
          <>
            This customer has <strong>no email address</strong> in GoHighLevel, so the document can&apos;t
            be sent. Add one to the contact in GoHighLevel first.
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
