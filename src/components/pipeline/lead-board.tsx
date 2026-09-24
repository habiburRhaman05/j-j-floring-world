"use client";

import { useState } from "react";
import { Pill } from "@/components/ui/pill";
import { relative } from "@/lib/format";
import type { Lead, LeadStage, User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LeadBoardProps {
  leads: Lead[];
  stages: readonly LeadStage[];
  users: User[];
  /** The rep's own board hides the rep chip; the office board shows it. */
  showRep?: boolean;
  onOpen: (lead: Lead) => void;
  /** Drag a card to a new column, or omit to keep the board read-only for stage. */
  onStageChange?: (lead: Lead, stage: LeadStage) => void;
}

/**
 * Cards remain click-to-open (same as before: a card is one tap on a phone).
 * Drag-and-drop is additive, for the office/desktop workflow - dropping a
 * card on a column moves it to that stage without opening the dialog.
 */
export function LeadBoard({ leads, stages, users, showRep = true, onOpen, onStageChange }: LeadBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);

  return (
    <div className="board">
      {stages.map((stage) => {
        const items = leads.filter((l) => l.stage === stage);
        return (
          <div
            key={stage}
            className={cn(
              "col",
              stage === "Won" && "won",
              stage === "Lost" && "lost",
              onStageChange && overStage === stage && "col-drop-target",
            )}
            onDragOver={
              onStageChange
                ? (event) => {
                    event.preventDefault();
                    setOverStage(stage);
                  }
                : undefined
            }
            onDragLeave={onStageChange ? () => setOverStage((s) => (s === stage ? null : s)) : undefined}
            onDrop={
              onStageChange
                ? (event) => {
                    event.preventDefault();
                    setOverStage(null);
                    const id = event.dataTransfer.getData("text/lead-id") || draggingId;
                    const lead = leads.find((l) => l.id === id);
                    if (lead && lead.stage !== stage) onStageChange(lead, stage);
                    setDraggingId(null);
                  }
                : undefined
            }
          >
            <div className="col-head">
              <span className="name">{stage}</span>
              <span className="count">{items.length}</span>
            </div>
            <div className="col-body">
              {items.length === 0 ? (
                <div className="t-meta" style={{ padding: "4px 2px" }}>
                  Nothing here
                </div>
              ) : null}

              {items.map((lead) => {
                const rep = users.find((u) => u.id === lead.assignedRepId);
                return (
                  <div
                    key={lead.id}
                    className={cn(
                      "tile",
                      stage === "Won" && "won",
                      stage === "Lost" && "lost",
                      draggingId === lead.id && "dragging",
                    )}
                    role="button"
                    tabIndex={0}
                    draggable={Boolean(onStageChange)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/lead-id", lead.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingId(lead.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStage(null);
                    }}
                    onClick={() => onOpen(lead)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onOpen(lead);
                    }}
                  >
                    <div className="tile-name">{lead.name}</div>
                    <div className="tile-meta">
                      {lead.zipCode}, {lead.source}
                    </div>
                    <div className="tile-foot">
                      {showRep && rep ? (
                        <Pill className="pill-outline">{rep.name.split(" ")[0]}</Pill>
                      ) : null}
                      <span className="t-meta">{relative(lead.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
