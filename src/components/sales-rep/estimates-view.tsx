"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { EstimateBuilder } from "@/components/estimator/estimate-builder";
import { SignSheet } from "@/components/estimator/sign-sheet";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { StagePill } from "@/components/ui/pill";
import { useSendEstimate } from "@/lib/data/hooks";
import { totalsFor } from "@/lib/data/pricing";
import { dt, money2 } from "@/lib/format";
import type { Database, Estimate } from "@/lib/types";

export function RepEstimates({ db, meId }: { db: Database; meId: string }) {
  const sendEstimate = useSendEstimate();
  const { toast } = useToast();

  const [builder, setBuilder] = useState<{ key: number; estimateId?: string } | null>(null);
  const [signSheetId, setSignSheetId] = useState<string | null>(null);

  const estimates = db.estimates.filter((e) => e.repId === meId);

  const columns: DataTableColumn<Estimate>[] = [
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const lead = db.leads.find((l) => l.id === row.original.leadId);
        return (
          <>
            <div style={{ fontWeight: 600 }}>{lead ? lead.name : row.original.leadId}</div>
            <div className="t-meta">
              {row.original.id}, {dt(row.original.createdAt)}
            </div>
          </>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StagePill stage={row.original.status} />,
    },
    {
      id: "tier",
      header: "Accepted tier",
      cell: ({ row }) => (
        <span className={row.original.acceptedTier ? undefined : "muted"}>
          {row.original.acceptedTier ?? "-"}
        </span>
      ),
    },
    {
      id: "price",
      header: "Price",
      meta: { numeric: true },
      cell: ({ row }) => {
        const tier = row.original.acceptedTier ?? "Better";
        return money2(totalsFor(db.products, row.original.tiers[tier]).totalPrice);
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
              <>
                <Button
                  size="sm"
                  onClick={() => setBuilder({ key: Date.now(), estimateId: estimate.id })}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    sendEstimate.mutate([estimate.id]);
                    toast("Estimate sent.", "ok");
                  }}
                >
                  Send
                </Button>
              </>
            ) : null}
            {estimate.status !== "Draft" ? (
              <Button
                size="sm"
                variant={estimate.status === "Signed" ? "default" : "go"}
                onClick={() => setSignSheetId(estimate.id)}
              >
                {estimate.status === "Signed" ? "View signed" : "Open sign sheet"}
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
        </div>
        <Button size="sm" variant="primary" onClick={() => setBuilder({ key: Date.now() })}>
          New estimate
        </Button>
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

      {signSheetId ? (
        <SignSheet open db={db} estimateId={signSheetId} onOpenChange={() => setSignSheetId(null)} />
      ) : null}
    </>
  );
}
