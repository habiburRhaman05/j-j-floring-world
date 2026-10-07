"use client";

import { AdminOverview } from "@/components/admin/overview";
import { ViewSection } from "@/components/layout/view-section";

export default function AdminDashboardPage() {
  return (
    <ViewSection
      viewKey="overview"
      heading="Company dashboard"
      sub="Live from GoHighLevel: deals, revenue, invoices and what each rep has earned."
    >
      <AdminOverview />
    </ViewSection>
  );
}
