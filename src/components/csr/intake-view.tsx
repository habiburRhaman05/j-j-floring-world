"use client";

import { useMemo, useState } from "react";
import { FbLeadContactsTable } from "@/components/csr/fb-lead-contacts-table";
import { PipelineBoard, PipelineBoardSkeleton } from "@/components/csr/pipeline-board";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { toApiError } from "@/lib/api/errors";
import { useBoardOpportunities, useCsrPipelines, useMoveOpportunity } from "@/lib/csr/hooks";
import type { CsrBoardOpportunity } from "@/lib/csr/types";
import { money2 } from "@/lib/format";

/**
 * The CSR dashboard, read live from GoHighLevel on every load: a select box
 * over all of the location's pipelines (lead-qualify first), that pipeline's
 * board with drag-and-drop stage changes, and the fb-lead contact list.
 *
 * PERMISSIONS: this view never touches products, estimates, invoices,
 * commission or any of the app's own pricing.
 */
export function CsrIntake() {
  const pipelinesQuery = useCsrPipelines();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [movingIds, setMovingIds] = useState<ReadonlySet<string>>(new Set());
  const move = useMoveOpportunity();

  const pipelines = pipelinesQuery.data?.pipelines ?? [];
  // A pick that has since disappeared from GHL falls back to the default.
  const pipelineId =
    pickedId && pipelines.some((p) => p.id === pickedId)
      ? pickedId
      : (pipelinesQuery.data?.defaultPipelineId ?? null);
  const pipeline = pipelines.find((p) => p.id === pipelineId) ?? null;

  const opportunitiesQuery = useBoardOpportunities(pipelineId);
  const opportunities = useMemo(
    () => opportunitiesQuery.data?.opportunities ?? [],
    [opportunitiesQuery.data],
  );

  const stageByContactId = useMemo(() => {
    const stageName = new Map((pipeline?.stages ?? []).map((s) => [s.id, s.name] as const));
    const map = new Map<string, string>();
    for (const o of opportunities) {
      const name = stageName.get(o.stageId);
      if (o.contactId && name) map.set(o.contactId, name);
    }
    return map;
  }, [opportunities, pipeline]);

  function moveCard(opportunity: CsrBoardOpportunity, stageId: string) {
    if (!pipelineId) return;
    setMovingIds((ids) => new Set(ids).add(opportunity.id));
    move.mutate(
      { opportunityId: opportunity.id, pipelineId, stageId },
      {
        onSettled: () =>
          setMovingIds((ids) => {
            const next = new Set(ids);
            next.delete(opportunity.id);
            return next;
          }),
      },
    );
  }

  const total = opportunities.reduce((sum, o) => sum + o.value, 0);
  const refreshing =
    (pipelinesQuery.isFetching || opportunitiesQuery.isFetching) &&
    !pipelinesQuery.isPending &&
    !opportunitiesQuery.isPending;

  function refresh() {
    void pipelinesQuery.refetch();
    void opportunitiesQuery.refetch();
  }

  return (
    <>
      <div className="spread" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <Select
            aria-label="Pipeline"
            value={pipelineId ?? ""}
            disabled={pipelinesQuery.isPending || pipelines.length === 0}
            onChange={(event) => setPickedId(event.target.value)}
            style={{ minWidth: 240, width: "auto" }}
          >
            {pipelinesQuery.isPending ? <option value="">Loading pipelines…</option> : null}
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          {pipeline && opportunitiesQuery.data ? (
            <span className="pill pill-outline">
              {opportunities.length} {opportunities.length === 1 ? "opportunity" : "opportunities"}
              {total > 0 ? ` · ${money2(total)}` : ""}
            </span>
          ) : null}
        </div>
        <Button size="sm" variant="ghost" loading={refreshing} onClick={refresh}>
          Refresh from GoHighLevel
        </Button>
      </div>

      {pipelinesQuery.error ? (
        <div className="login-alert" role="alert">
          {toApiError(pipelinesQuery.error).displayMessage}
        </div>
      ) : pipelinesQuery.isPending || (pipelineId && opportunitiesQuery.isPending) ? (
        <PipelineBoardSkeleton />
      ) : !pipeline ? (
        <EmptyState
          title="No pipelines found"
          message="This GoHighLevel location has no pipelines yet."
        />
      ) : opportunitiesQuery.error ? (
        <div className="login-alert" role="alert">
          {toApiError(opportunitiesQuery.error).displayMessage}
        </div>
      ) : (
        <PipelineBoard
          pipeline={pipeline}
          opportunities={opportunities}
          locationId={pipelinesQuery.data?.locationId ?? ""}
          movingIds={movingIds}
          onMove={moveCard}
        />
      )}

      <FbLeadContactsTable
        pipelineName={pipeline?.name ?? null}
        stageByContactId={stageByContactId}
      />
    </>
  );
}
