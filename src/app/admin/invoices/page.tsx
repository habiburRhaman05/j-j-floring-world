"use client";

import { InvoicesPanel } from "@/components/sales/invoices-panel";
import { ViewSection } from "@/components/layout/view-section";

export default function AdminInvoicesPage() {
  return (
    <ViewSection
      viewKey="invoices"
      heading="Invoices"
      sub="All invoices synced from GoHighLevel."
    >
      <InvoicesPanel isAdmin />
    </ViewSection>
  );
}
