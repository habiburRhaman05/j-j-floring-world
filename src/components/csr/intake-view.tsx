"use client";

import { useState } from "react";
import { CsrLeadDialog } from "@/components/leads/csr-lead-dialog";
import { LeadBoard } from "@/components/pipeline/lead-board";
import { FbLeadContactsTable } from "@/components/csr/fb-lead-contacts-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat, StatStrip } from "@/components/ui/stat";
import { useSetLeadStage } from "@/lib/data/hooks";
import { CSR_STAGES } from "@/lib/constants";
import type { CsrStage, Database, Lead } from "@/lib/types";

/**
 * PERMISSIONS: this view never touches products, estimates, invoices,
 * commission or any money field. Pricing lives with the estimators.
 */
export function CsrIntake({ db, meId }: { db: Database; meId: string }) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const setLeadStage = useSetLeadStage();

  const leads = db.leads.filter((l) =>
    (CSR_STAGES as readonly string[]).includes(l.stage),
  );

  const selectedLead = selectedLeadId
    ? (db.leads.find((l) => l.id === selectedLeadId) ?? null)
    : null;

  return (
    <>
      <StatStrip style={{ marginBottom: 16 }}>
        {CSR_STAGES.map((stage: CsrStage) => (
          <Stat
            key={stage}
            label={stage}
            value={String(leads.filter((l) => l.stage === stage).length)}
          />
        ))}
      </StatStrip>

      {leads.length === 0 ? (
        <EmptyState
          title="Board is clear"
          message="Every intake lead has been qualified and handed to a rep."
        />
      ) : (
        <LeadBoard
          leads={leads}
          stages={CSR_STAGES}
          users={db.users}
          onOpen={(lead) => setSelectedLeadId(lead.id)}
          onStageChange={(lead: Lead, stage) => setLeadStage.mutate([lead.id, stage])}
        />
      )}

      {selectedLead ? (
        <CsrLeadDialog
          lead={selectedLead}
          db={db}
          meId={meId}
          onClose={() => setSelectedLeadId(null)}
        />
      ) : null}

      <FbLeadContactsTable />
    </>
  );
}
