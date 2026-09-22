"use client";

import { CsrIntake } from "@/components/csr/intake-view";
import { ViewSection } from "@/components/layout/view-section";
import { useCurrentUser } from "@/components/providers/session-provider";
import { useAppDb } from "@/lib/data/hooks";

export default function CsrIntakePage() {
  const db = useAppDb();
  const me = useCurrentUser();

  return (
    <ViewSection
      viewKey="intake"
      heading="Intake board"
      sub="New leads through to booked appointments. Pricing lives with the estimators."
    >
      <CsrIntake db={db} meId={me?.id ?? "u_csr"} />
    </ViewSection>
  );
}
