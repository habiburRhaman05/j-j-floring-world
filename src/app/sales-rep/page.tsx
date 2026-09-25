"use client";

import { ViewSection } from "@/components/layout/view-section";
import { SalesDashboard } from "@/components/sales/sales-dashboard";

export default function SalesRepPipelinePage() {
  return (
    <ViewSection
      viewKey="pipeline"
      heading="My pipeline"
      sub="Live from GoHighLevel: the leads, contacts and deals assigned to you, and how you're doing."
    >
      <SalesDashboard scope="own" />
    </ViewSection>
  );
}
