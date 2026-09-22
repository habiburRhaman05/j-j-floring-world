import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { NewEstimateButton } from "@/components/sales-rep/new-estimate-button";
import { SALES_REP_NAV } from "@/lib/navigation";
import { requireUser } from "@/lib/auth/session.server";

/**
 * PERMISSIONS: nothing under /sales-rep reads costPerUnit, totalCost or
 * totalMargin. The components below never construct a node holding a cost or
 * margin figure, so those values are absent from the rendered DOM.
 */
export default async function SalesRepLayout({ children }: { children: ReactNode }) {
  await requireUser(["sales_rep"]);

  return (
    <WorkspaceShell
      role="Sales Rep"
      moduleLabel="Workspace"
      ariaLabel="Sales navigation"
      items={SALES_REP_NAV}
      headerExtras={<NewEstimateButton />}
    >
      {children}
    </WorkspaceShell>
  );
}
