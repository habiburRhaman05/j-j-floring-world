import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { ADMIN_NAV } from "@/lib/navigation";
import { requireUser } from "@/lib/auth/session.server";

/**
 * Admin is the only role that sees cost, margin, commission and the sync log.
 * The shell is mounted here once, so every /admin segment shares the same top
 * bar and tab strip and only the page below swaps out.
 *
 * `requireUser` is the authoritative, database-backed check: it runs on every
 * request, before any client JS, and reflects a suspension or role change
 * immediately (doc 04 §7's stated reason for database sessions over JWT).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireUser(["admin"]);

  return (
    <WorkspaceShell
      role="Admin"
      moduleLabel="Workspace"
      ariaLabel="Admin navigation"
      items={ADMIN_NAV}
    >
      {children}
    </WorkspaceShell>
  );
}
