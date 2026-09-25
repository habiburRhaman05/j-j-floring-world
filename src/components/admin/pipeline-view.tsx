"use client";

import { useState } from "react";
import { EstimateDetail } from "@/components/estimator/estimate-detail";
import { AdminLeadDialog } from "@/components/leads/admin-lead-dialog";
import { LeadBoard } from "@/components/pipeline/lead-board";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { SALES_STAGES } from "@/lib/constants";
import type { Database } from "@/lib/types";

interface AdminPipelineProps {
  db: Database;
  onNewEstimate: () => void;
}

export function AdminPipeline({ db, onNewEstimate }: AdminPipelineProps) {
  const [repFilter, setRepFilter] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [signSheetId, setSignSheetId] = useState<string | null>(null);

  const reps = db.users.filter((u) => u.role === "Sales Rep");
  const leads = db.leads.filter((l) => !repFilter || l.assignedRepId === repFilter);

  // Selection is held as an id so the dialog always reads the live record.
  const selectedLead = selectedLeadId
    ? (db.leads.find((l) => l.id === selectedLeadId) ?? null)
    : null;

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div className="row">
          <span className="label" style={{ margin: 0 }}>
            Filter
          </span>
          <Select
            style={{ maxWidth: 220 }}
            value={repFilter}
            onChange={(event) => setRepFilter(event.target.value)}
          >
            <option value="">All reps</option>
            {reps.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <Button size="sm" variant="primary" onClick={onNewEstimate}>
          New estimate
        </Button>
      </div>

      <LeadBoard
        leads={leads}
        stages={SALES_STAGES}
        users={db.users}
        onOpen={(lead) => setSelectedLeadId(lead.id)}
      />

      {selectedLead ? (
        <AdminLeadDialog
          lead={selectedLead}
          db={db}
          onClose={() => setSelectedLeadId(null)}
          onOpenEstimate={(estimateId) => {
            setSelectedLeadId(null);
            setSignSheetId(estimateId);
          }}
        />
      ) : null}

      {signSheetId ? (
        <EstimateDetail open db={db} estimateId={signSheetId} onOpenChange={() => setSignSheetId(null)} />
      ) : null}
    </>
  );
}
