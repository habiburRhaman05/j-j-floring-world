"use client";

import { GhlConnectionPanel } from "@/components/admin/ghl-connection-panel";
import { AdminSync } from "@/components/admin/sync-view";
import { ViewSection } from "@/components/layout/view-section";
import { useAppDb } from "@/lib/data/hooks";

export default function AdminSyncPage() {
  const db = useAppDb();

  return (
    <ViewSection
      viewKey="sync"
      heading="Sync and settings"
      sub="Connect GoHighLevel, then watch what moves between the two systems."
    >
      <GhlConnectionPanel />
      <AdminSync db={db} />
    </ViewSection>
  );
}
