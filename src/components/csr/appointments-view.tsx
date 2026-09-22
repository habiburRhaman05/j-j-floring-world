"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { dayLabel, timeLabel } from "@/lib/format";
import type { Database } from "@/lib/types";

export function CsrAppointments({ db }: { db: Database }) {
  const booked = db.leads
    .filter((l) => l.appointmentAt)
    .sort(
      (a, b) => new Date(a.appointmentAt ?? 0).getTime() - new Date(b.appointmentAt ?? 0).getTime(),
    );

  if (!booked.length) {
    return (
      <EmptyState
        title="Nothing booked"
        message="Open a lead on the intake board and schedule a measure."
      />
    );
  }

  return (
    <Panel>
      <PanelHead>
        <h3>Schedule</h3>
        <span className="t-meta">{booked.length} appointments</span>
      </PanelHead>
      <PanelBody tight>
        {booked.map((lead) => {
          const rep = db.users.find((u) => u.id === lead.assignedRepId) ?? null;
          return (
            <div key={lead.id} className="list-row">
              <div className="lr-main">
                <div className="lr-title">{lead.name}</div>
                <div className="lr-meta">
                  {lead.address}, {rep ? rep.name : "Unassigned"}
                </div>
              </div>
              <div className="lr-right">
                <div className="lr-title">{dayLabel(lead.appointmentAt)}</div>
                <div className="lr-meta">{timeLabel(lead.appointmentAt)}</div>
              </div>
            </div>
          );
        })}
      </PanelBody>
    </Panel>
  );
}
