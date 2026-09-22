"use client";

import { AdminOverview } from "@/components/admin/overview";
import { ViewSection } from "@/components/layout/view-section";
import { useAppDb } from "@/lib/data/hooks";

export default function AdminDashboardPage() {
  const db = useAppDb();

  return (
    <ViewSection
      viewKey="overview"
      heading="Company dashboard"
      sub="Revenue, cost and margin across every job on the books."
    >
      <AdminOverview db={db} role="Admin" />
    </ViewSection>
  );
}
