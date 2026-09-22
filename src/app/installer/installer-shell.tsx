"use client";

import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { useCurrentUser } from "@/components/providers/session-provider";
import { useAppDb } from "@/lib/data/hooks";
import { myJobs, todayJobs } from "@/lib/data/installer";
import { INSTALLER_NAV } from "@/lib/navigation";

/**
 * PERMISSIONS: nothing under /installer reads a price, a cost or any invoice
 * money field. Jobs are filtered strictly to the signed-in installer, so
 * another crew's work is never built into the DOM either.
 *
 * Split out of layout.tsx so the server-side `requireUser` check in that file
 * can run before any client JS, while this piece keeps the hooks it needs for
 * the Today badge count.
 */
export function InstallerShell({ children }: { children: ReactNode }) {
  const db = useAppDb();
  const me = useCurrentUser();
  const today = todayJobs(myJobs(db, me?.id ?? ""));

  return (
    <WorkspaceShell
      role="Installer"
      ariaLabel="Installer navigation"
      items={INSTALLER_NAV}
      nav="bottom"
      mainClassName="inst-main"
      badges={{ today: today.length ? String(today.length) : undefined }}
    >
      {children}
    </WorkspaceShell>
  );
}
