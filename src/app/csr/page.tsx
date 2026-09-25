"use client";

import { CsrIntake } from "@/components/csr/intake-view";
import { ViewSection } from "@/components/layout/view-section";

export default function CsrIntakePage() {
  return (
    <ViewSection
      viewKey="intake"
      heading="Intake board"
      sub="Live from GoHighLevel: every pipeline, and every contact tagged fb-lead."
    >
      <CsrIntake />
    </ViewSection>
  );
}
