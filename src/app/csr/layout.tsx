import type { ReactNode } from "react";
import { NewLeadButton } from "@/components/csr/new-lead-button";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { CSR_NAV } from "@/lib/navigation";
import { requireUser } from "@/lib/auth/session.server";

/**
 * PERMISSIONS: nothing under /csr touches products, estimates, invoices,
 * commission or any money field. There is no price anywhere in the DOM these
 * pages build.
 */
export default async function CsrLayout({ children }: { children: ReactNode }) {
  await requireUser(["csr"]);

  return (
    <WorkspaceShell
      role="CSR"
      moduleLabel="Front desk"
      ariaLabel="CSR navigation"
      items={CSR_NAV}
      headerExtras={<NewLeadButton />}
    >
      {children}
    </WorkspaceShell>
  );
}
