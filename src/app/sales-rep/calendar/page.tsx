"use client";

import { ViewSection } from "@/components/layout/view-section";
import { useCurrentUser } from "@/components/providers/session-provider";
import { RepCalendar } from "@/components/sales-rep/calendar-view";
import { useAppDb } from "@/lib/data/hooks";

export default function SalesRepCalendarPage() {
  const db = useAppDb();
  const me = useCurrentUser();

  return (
    <ViewSection
      viewKey="calendar"
      heading="Appointments"
      sub="Measures and consultations booked for you."
    >
      <RepCalendar db={db} meId={me?.id ?? ""} />
    </ViewSection>
  );
}
