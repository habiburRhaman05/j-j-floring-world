"use client";

import { CsrAppointments } from "@/components/csr/appointments-view";
import { ViewSection } from "@/components/layout/view-section";
import { useAppDb } from "@/lib/data/hooks";

export default function CsrAppointmentsPage() {
  const db = useAppDb();

  return (
    <ViewSection
      viewKey="appointments"
      heading="Booked appointments"
      sub="Everything you have scheduled, by date."
    >
      <CsrAppointments db={db} />
    </ViewSection>
  );
}
