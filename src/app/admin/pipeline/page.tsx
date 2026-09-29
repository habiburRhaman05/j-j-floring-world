"use client";

import { ViewSection } from "@/components/layout/view-section";
import { SalesDashboard } from "@/components/sales/sales-dashboard";

export default function AdminPipelinePage() {
  return (
    <ViewSection
      viewKey="pipeline"
      heading="Sales pipeline"
      sub="Live from the sales pipeline: every rep, every deal, with win rate, commission and margin."
    >
      <SalesDashboard scope="all" />
    </ViewSection>
  );
}
