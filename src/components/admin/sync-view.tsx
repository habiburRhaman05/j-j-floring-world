"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { Panel, PanelBody, PanelFoot, PanelHead } from "@/components/ui/panel";
import { useClearSyncLog, useResetDemoData, useSimulateInboundEvent } from "@/lib/data/hooks";
import { relative } from "@/lib/format";
import type { Database } from "@/lib/types";

export function AdminSync({ db }: { db: Database }) {
  const clearSyncLog = useClearSyncLog();
  const resetDemoData = useResetDemoData();
  const simulateInbound = useSimulateInboundEvent();
  const { toast } = useToast();

  const [confirmReset, setConfirmReset] = useState(false);
  const entries = db.syncLog;

  return (
    <>
      <Panel>
        <PanelHead>
          <div>
            <h3>Sync Activity Log</h3>
            <div className="t-meta">
              Stubbed GoHighLevel integration. No network calls are made.
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            loading={clearSyncLog.isPending}
            onClick={() => clearSyncLog.mutate()}
          >
            Clear
          </Button>
        </PanelHead>
        <PanelBody>
          <div className="sync-feed">
            {entries.length === 0 ? (
              <EmptyState
                title="Nothing yet"
                message="Sync events appear here as soon as something changes in the app."
              />
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className={`sync-item ${entry.dir}`}>
                  <span className="arrow">{entry.dir === "out" ? "OUT" : "IN"}</span>
                  <span className="msg">
                    <div>{entry.message}</div>
                    <div className="t-meta t-mono">{entry.event}</div>
                  </span>
                  <time>{relative(entry.at)}</time>
                </div>
              ))
            )}
          </div>
        </PanelBody>
        <PanelFoot>
          <div className="t-meta">
            When the private integration token exists, only transport() inside the sync module
            changes. Every caller stays the same.
          </div>
        </PanelFoot>
      </Panel>

      <Panel className="section">
        <PanelHead>
          <h3>Demo controls</h3>
        </PanelHead>
        <PanelBody>
          <p className="t-sub">
            Reset wipes everything created during the demo and reloads the seeded leads,
            products, estimates and jobs.
          </p>
          <div className="row-wrap">
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              Reset demo data
            </Button>
            <Button
              loading={simulateInbound.isPending}
              onClick={() => {
                simulateInbound.mutate(undefined, {
                  onSuccess: () => toast("Inbound event logged."),
                });
              }}
            >
              Simulate inbound GHL event
            </Button>
            <span className="t-meta">Data: in-memory store (frontend build)</span>
          </div>
        </PanelBody>
      </Panel>

      <Modal
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset demo data"
        actions={[
          { label: "Cancel", variant: "ghost" },
          {
            label: "Reset",
            variant: "danger",
            onClick: async () => {
              try {
                await resetDemoData.mutateAsync();
              } catch {
                return false;
              }
              toast("Demo data reset.", "ok");
            },
          },
        ]}
      >
        <p className="t-sub">
          Everything you created in this session is discarded and the original seed set is
          restored.
        </p>
      </Modal>
    </>
  );
}
