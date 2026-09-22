"use client";

import { ViewSection } from "@/components/layout/view-section";
import { useCurrentUser } from "@/components/providers/session-provider";
import { RepPipeline } from "@/components/sales-rep/pipeline-view";
import { useAppDb } from "@/lib/data/hooks";

export default function SalesRepPipelinePage() {
  const db = useAppDb();
  const me = useCurrentUser();

  return (
    <ViewSection
      viewKey="pipeline"
      heading="My pipeline"
      sub="Only the leads assigned to you. Open a card to work it."
    >
      <RepPipeline db={db} meId={me?.id ?? ""} />
    </ViewSection>
  );
}
