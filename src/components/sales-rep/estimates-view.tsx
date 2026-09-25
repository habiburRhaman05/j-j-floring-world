"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { EstimateBuilder } from "@/components/estimator/estimate-builder";
import { EstimateDetail } from "@/components/estimator/estimate-detail";
import { EstimateStatusPill } from "@/components/estimator/estimate-status";
import { SendEstimateDialog } from "@/components/estimator/send-estimate-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { apiPost } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { useInvalidateAppDb } from "@/lib/data/hooks";
import { estimateTierTotals } from "@/lib/data/pricing";
import { dt, money2 } from "@/lib/format";
import type { Database, Estimate } from "@/lib/types";

export function RepEstimates({ db, meId }: { db: Database; meId: string }) {
  const { toast } = useToast();
  const invalidate = useInvalidateAppDb();

  const [builder, setBuilder] = useState<{ key: number; estimateId?: string } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [sendId, setSendId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const estimates = db.estimates.filter((e) => e.repId === meId);
  const waiting = estimates.filter((e) => e.status === "Sent" || e.status === "Viewed").length;
  const sending = sendId ? (estimates.find((e) => e.id === sendId) ?? null) : null;

  async function checkForSignatures() {
    setChecking(true);
    try {
      const { changed } = await apiPost<{ changed: number }>(endpoints.estimates.sync);
      await invalidate();
      toast(changed ? `${changed} estimate${changed === 1 ? "" : "s"} updated from GoHighLevel.` : "No new signatures yet.", changed ? "ok" : undefined);
    } catch (error) {
      toast(toApiError(error).displayMessage, "warn", 4600);
    } finally {
      setChecking(false);
    }
  }

  const columns: DataTableColumn<Estimate>[] = [
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const lead = db.leads.find((l) => l.id === row.original.leadId);
        return (
          <>
            <div style={{ fontWeight: 600 }}>{row.original.customer?.name || lead?.name || row.original.leadId}</div>
            <div className="t-meta">
              {row.original.number}, {dt(row.original.createdAt)}
            </div>
          </>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <EstimateStatusPill status={row.original.status} />,
    },
    {
      id: "tier",
      header: "Package",
      cell: ({ row }) => {
        const e = row.original;
        const tier = e.acceptedTier ?? e.sentTier;
        return (
          <span className={tier ? undefined : "muted"}>
            {tier ? `${e.tierMeta[tier]?.label || tier}${e.acceptedTier ? "" : " (sent)"}` : "-"}
          </span>
        );
      },
    },
    {
      id: "price",
      header: "Price",
      meta: { numeric: true },
      cell: ({ row }) => {
        const e = row.original;
        const tier = e.acceptedTier ?? e.sentTier ?? "Better";
        return money2(estimateTierTotals(e.tiers[tier], e.tierMeta[tier], e.taxRate).totalPrice);
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const estimate = row.original;
        return (
          <div className="row">
            {estimate.status === "Draft" ? (
              <Button
                size="sm"
                onClick={() => setBuilder({ key: Date.now(), estimateId: estimate.id })}
              >
                Edit
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setDetailId(estimate.id)}>
              View
            </Button>
            {estimate.status === "Draft" ? (
              <Button size="sm" variant="primary" onClick={() => setSendId(estimate.id)}>
                Send
              </Button>
            ) : null}
            {estimate.status === "Sent" || estimate.status === "Viewed" ? (
              <Button size="sm" variant="ghost" onClick={() => setSendId(estimate.id)}>
                Resend
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div className="t-sub">
          {estimates.length} estimate{estimates.length === 1 ? "" : "s"} on your book
          {waiting ? `, ${waiting} waiting for approval` : ""}
        </div>
        <div className="row">
          {waiting ? (
            <Button size="sm" variant="ghost" loading={checking} onClick={() => void checkForSignatures()}>
              Check for signatures
            </Button>
          ) : null}
          <Button size="sm" variant="primary" onClick={() => setBuilder({ key: Date.now() })}>
            New estimate
          </Button>
        </div>
      </div>

      {estimates.length === 0 ? (
        <EmptyState
          title="No estimates yet"
          message="Pick a lead from your pipeline and build Good, Better and Best options."
        />
      ) : (
        <Panel>
          <DataTable columns={columns} data={estimates} />
        </Panel>
      )}

      {builder ? (
        <EstimateBuilder
          key={builder.key}
          open
          onOpenChange={() => setBuilder(null)}
          db={db}
          role="Sales Rep"
          repId={meId}
          estimateId={builder.estimateId}
        />
      ) : null}

      {detailId ? (
        <EstimateDetail open db={db} estimateId={detailId} onOpenChange={() => setDetailId(null)} />
      ) : null}

      {sending ? <SendEstimateDialog estimate={sending} onClose={() => setSendId(null)} /> : null}
    </>
  );
}
