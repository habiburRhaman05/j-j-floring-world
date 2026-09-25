"use client";

import { useState } from "react";
import { EstimateBuilder } from "@/components/estimator/estimate-builder";
import { EstimateDetail } from "@/components/estimator/estimate-detail";
import { RepLeadDialog } from "@/components/leads/rep-lead-dialog";
import { LeadBoard } from "@/components/pipeline/lead-board";
import { Stat, StatStrip } from "@/components/ui/stat";
import { SALES_STAGES } from "@/lib/constants";
import type { Database } from "@/lib/types";

export function RepPipeline({ db, meId }: { db: Database; meId: string }) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [builder, setBuilder] = useState<{ key: number; leadId?: string } | null>(null);
  const [signSheetId, setSignSheetId] = useState<string | null>(null);

  const leads = db.leads.filter((l) => l.assignedRepId === meId);

  const counts = { open: 0, sent: 0, won: 0 };
  for (const lead of leads) {
    if (lead.stage === "Won") counts.won += 1;
    else if (lead.stage === "Estimate Sent" || lead.stage === "Follow-Up") counts.sent += 1;
    else if (lead.stage !== "Lost") counts.open += 1;
  }

  const selectedLead = selectedLeadId
    ? (db.leads.find((l) => l.id === selectedLeadId) ?? null)
    : null;

  return (
    <>
      <StatStrip style={{ marginBottom: 16 }}>
        <Stat label="Working" value={String(counts.open)} note="Not yet quoted" />
        <Stat label="Awaiting signature" value={String(counts.sent)} note="Estimate out" />
        <Stat label="Won" value={String(counts.won)} note="Signed this pipeline" tone="good" />
      </StatStrip>

      <LeadBoard
        leads={leads}
        stages={SALES_STAGES}
        users={db.users}
        showRep={false}
        onOpen={(lead) => setSelectedLeadId(lead.id)}
      />

      {selectedLead ? (
        <RepLeadDialog
          lead={selectedLead}
          db={db}
          meId={meId}
          onClose={() => setSelectedLeadId(null)}
          onBuildEstimate={(leadId) => {
            setSelectedLeadId(null);
            setBuilder({ key: Date.now(), leadId });
          }}
          onOpenEstimate={(estimateId) => {
            setSelectedLeadId(null);
            setSignSheetId(estimateId);
          }}
        />
      ) : null}

      {builder ? (
        <EstimateBuilder
          key={builder.key}
          open
          onOpenChange={() => setBuilder(null)}
          db={db}
          role="Sales Rep"
          repId={meId}
          leadId={builder.leadId}
        />
      ) : null}

      {signSheetId ? (
        <EstimateDetail open db={db} estimateId={signSheetId} onOpenChange={() => setSignSheetId(null)} />
      ) : null}
    </>
  );
}
