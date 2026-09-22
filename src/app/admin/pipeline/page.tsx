"use client";

import { useState } from "react";
import { AdminPipeline } from "@/components/admin/pipeline-view";
import { EstimateBuilder } from "@/components/estimator/estimate-builder";
import { ViewSection } from "@/components/layout/view-section";
import { useCurrentUser } from "@/components/providers/session-provider";
import { useAppDb } from "@/lib/data/hooks";

export default function AdminPipelinePage() {
  const db = useAppDb();
  const me = useCurrentUser();
  const [builderKey, setBuilderKey] = useState<number | null>(null);

  return (
    <ViewSection
      viewKey="pipeline"
      heading="Sales pipeline"
      sub="Every lead, every rep. Open a card to change stage or review estimates."
    >
      <AdminPipeline db={db} onNewEstimate={() => setBuilderKey(Date.now())} />

      {builderKey !== null ? (
        <EstimateBuilder
          key={builderKey}
          open
          onOpenChange={() => setBuilderKey(null)}
          db={db}
          role="Admin"
          repId={me?.id ?? "u_rep_a"}
        />
      ) : null}
    </ViewSection>
  );
}
