"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { dt, money2, relative } from "@/lib/format";
import type {
  CsrBoardOpportunity,
  CsrBoardPipeline,
} from "@/lib/csr/types";
import { cn } from "@/lib/utils";

interface PipelineBoardProps<T extends CsrBoardOpportunity> {
  pipeline: CsrBoardPipeline;
  opportunities: T[];
  locationId: string;
  /** Opportunity ids whose move is still being written to GHL. */
  movingIds: ReadonlySet<string>;
  onMove: (opportunity: T, stageId: string) => void;
  /** Who owns a card, shown on it (the admin sales board). */
  ownerOf?: (opportunity: T) => string | null;
}

/** Won/lost cards get the board's won/lost accent and a status pill. */
const STATUS_TILE: Record<string, string> = { won: "won", lost: "lost", abandoned: "lost" };

/** A stage GHL no longer lists but an opportunity still points at. */
const ORPHAN_STAGE_ID = "__unknown__";

/**
 * GHL's opportunities board: one column per stage, each headed by its count
 * and total value. Cards drag between columns; the drop is written to GHL.
 */
export function PipelineBoard<T extends CsrBoardOpportunity>({
  pipeline,
  opportunities,
  locationId,
  movingIds,
  onMove,
  ownerOf,
}: PipelineBoardProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const knownStages = new Set(pipeline.stages.map((s) => s.id));
  const orphans = opportunities.filter((o) => !knownStages.has(o.stageId));
  const columns = orphans.length
    ? [...pipeline.stages, { id: ORPHAN_STAGE_ID, name: "Other stage" }]
    : pipeline.stages;

  const opened = openId ? (opportunities.find((o) => o.id === openId) ?? null) : null;

  return (
    <>
      <div className="board" aria-label={`${pipeline.name} pipeline`}>
        {columns.map((stage) => {
          const items =
            stage.id === ORPHAN_STAGE_ID
              ? orphans
              : opportunities.filter((o) => o.stageId === stage.id);
          const total = items.reduce((sum, o) => sum + o.value, 0);
          const droppable = stage.id !== ORPHAN_STAGE_ID;

          return (
            <div
              key={stage.id}
              className={cn("col", droppable && overStageId === stage.id && "col-drop-target")}
              onDragOver={
                droppable
                  ? (event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setOverStageId(stage.id);
                    }
                  : undefined
              }
              onDragLeave={
                droppable
                  ? (event) => {
                      // Ignore leave events fired when the pointer crosses a child card.
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                      setOverStageId((current) => (current === stage.id ? null : current));
                    }
                  : undefined
              }
              onDrop={
                droppable
                  ? (event) => {
                      event.preventDefault();
                      setOverStageId(null);
                      const id = event.dataTransfer.getData("text/opportunity-id") || draggingId;
                      const opportunity = opportunities.find((o) => o.id === id);
                      if (opportunity && opportunity.stageId !== stage.id) onMove(opportunity, stage.id);
                      setDraggingId(null);
                    }
                  : undefined
              }
            >
              <div className="col-head col-head-stack">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="name">{stage.name}</span>
                </div>
                <div className="col-sub">
                  <span>
                    {items.length} {items.length === 1 ? "opportunity" : "opportunities"}
                  </span>
                  <span className="col-total">{money2(total)}</span>
                </div>
              </div>

              <div className="col-body">
                {items.map((opportunity) => {
                  const moving = movingIds.has(opportunity.id);
                  const owner = ownerOf?.(opportunity) ?? null;
                  const status = opportunity.status?.toLowerCase() ?? "open";
                  return (
                    <div
                      key={opportunity.id}
                      className={cn(
                        "tile",
                        STATUS_TILE[status],
                        draggingId === opportunity.id && "dragging",
                        moving && "tile-saving",
                      )}
                      role="button"
                      tabIndex={0}
                      draggable={!moving}
                      aria-busy={moving || undefined}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/opportunity-id", opportunity.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggingId(opportunity.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverStageId(null);
                      }}
                      onClick={() => setOpenId(opportunity.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") setOpenId(opportunity.id);
                      }}
                    >
                      <div className="tile-name">{opportunity.contactName}</div>
                      {opportunity.phone || opportunity.email ? (
                        <div className="tile-meta">{opportunity.phone || opportunity.email}</div>
                      ) : null}
                      <div className="tile-foot">
                        {status !== "open" ? (
                          <Pill className={status === "won" ? "pill-moss" : "pill-clay"}>
                            {status[0]!.toUpperCase() + status.slice(1)}
                          </Pill>
                        ) : null}
                        {owner ? <Pill className="pill-blue">{owner}</Pill> : null}
                        {opportunity.value > 0 ? (
                          <Pill className="pill-moss">{money2(opportunity.value)}</Pill>
                        ) : null}
                        {opportunity.tags.slice(0, 2).map((tag) => (
                          <Pill key={tag} className="pill-outline">
                            {tag}
                          </Pill>
                        ))}
                        {opportunity.createdAt ? (
                          <span className="t-meta">{relative(opportunity.createdAt)}</span>
                        ) : null}
                      </div>
                      {moving ? <span className="tile-saving-label">Saving to GoHighLevel…</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {opened ? (
        <OpportunityDialog
          opportunity={opened}
          pipeline={pipeline}
          locationId={locationId}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </>
  );
}

export function PipelineBoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="board" aria-busy="true" aria-label="Loading pipeline">
      {Array.from({ length: columns }, (_, i) => (
        <div key={i} className="col">
          <div className="col-head col-head-stack">
            <Skeleton style={{ width: "60%", height: 14 }} />
            <Skeleton style={{ width: "80%", height: 11, marginTop: 8 }} />
          </div>
          <div className="col-body">
            <Skeleton style={{ width: "100%", height: 74 }} />
            <Skeleton style={{ width: "100%", height: 74 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OpportunityDialog({
  opportunity,
  pipeline,
  locationId,
  onClose,
}: {
  opportunity: CsrBoardOpportunity & { ownerName?: string };
  pipeline: CsrBoardPipeline;
  locationId: string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const stage = pipeline.stages.find((s) => s.id === opportunity.stageId);
  const ghlUrl = opportunity.contactId
    ? `https://app.gohighlevel.com/v2/location/${encodeURIComponent(locationId)}/contacts/detail/${encodeURIComponent(opportunity.contactId)}`
    : null;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title={opportunity.contactName}
      subtitle={`${pipeline.name} · ${stage?.name ?? "Unknown stage"}`}
      actions={[{ label: "Close", variant: "ghost" }]}
    >
      <dl className="kv">
        <dt>Phone</dt>
        <dd>{opportunity.phone || "-"}</dd>
        <dt>Email</dt>
        <dd>{opportunity.email || "-"}</dd>
        <dt>Value</dt>
        <dd>{money2(opportunity.value)}</dd>
        <dt>Status</dt>
        <dd style={{ textTransform: "capitalize" }}>{opportunity.status}</dd>
        {opportunity.ownerName ? (
          <>
            <dt>Assigned to</dt>
            <dd>{opportunity.ownerName}</dd>
          </>
        ) : null}
        <dt>Opportunity</dt>
        <dd>{opportunity.name}</dd>
        <dt>Created</dt>
        <dd>{opportunity.createdAt ? dt(opportunity.createdAt, true) : "-"}</dd>
        <dt>Tags</dt>
        <dd>
          {opportunity.tags.length
            ? opportunity.tags.map((t) => (
                <Pill key={t} className="pill-outline">
                  {t}
                </Pill>
              ))
            : "-"}
        </dd>
      </dl>
      {ghlUrl ? (
        <div style={{ marginTop: 14 }}>
          <Button size="sm" asChild>
            <a href={ghlUrl} target="_blank" rel="noopener noreferrer">
              Open in GoHighLevel
            </a>
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
