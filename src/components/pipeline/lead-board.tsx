"use client";

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
}

/**
 * Stage changes are button and dropdown driven rather than drag and drop: it
 * is the same number of clicks on a phone and it never strands a card.
 */
export function LeadBoard({ leads, stages, users, showRep = true, onOpen }: LeadBoardProps) {
  return (
    <div className="board">
      {stages.map((stage) => {
        const items = leads.filter((l) => l.stage === stage);
        return (
          <div
            key={stage}
            className={cn("col", stage === "Won" && "won", stage === "Lost" && "lost")}
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
                    )}
                    role="button"
                    tabIndex={0}
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
