"use client";

import { ViewSection } from "@/components/layout/view-section";
import { useCurrentUser } from "@/components/providers/session-provider";
import { RepCommission } from "@/components/sales-rep/commission-view";
import { useAppDb } from "@/lib/data/hooks";

export default function SalesRepCommissionPage() {
  const db = useAppDb();
  const me = useCurrentUser();

  return (
    <ViewSection
      viewKey="commission"
      heading="Commission"
      sub="Your own numbers only. Company cost and margin are not part of this view."
    >
      <RepCommission db={db} meId={me?.id ?? ""} />
    </ViewSection>
  );
}
