"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { dayLabel, timeLabel } from "@/lib/format";
import type { Database } from "@/lib/types";

export function RepCalendar({ db, meId }: { db: Database; meId: string }) {
  const upcoming = db.leads
    .filter((l) => l.assignedRepId === meId && l.appointmentAt)
    .sort(
      (a, b) => new Date(a.appointmentAt ?? 0).getTime() - new Date(b.appointmentAt ?? 0).getTime(),
    );

  if (!upcoming.length) {
    return (
      <EmptyState
        title="Nothing booked"
        message="When a CSR schedules a measure for one of your leads it shows up here."
      />
    );
  }

  return (
    <Panel>
      <PanelHead>
        <h3>Upcoming</h3>
        <span className="t-meta">{upcoming.length} booked</span>
      </PanelHead>
      <PanelBody tight>
        {upcoming.map((lead) => (
          <div key={lead.id} className="list-row">
            <div className="lr-main">
              <div className="lr-title">{lead.name}</div>
              <div className="lr-meta">{lead.address}</div>
            </div>
            <div className="lr-right">
              <div className="lr-title">{dayLabel(lead.appointmentAt)}</div>
              <div className="lr-meta">{timeLabel(lead.appointmentAt)}</div>
            </div>
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}
