import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session.server";
import { InstallerShell } from "./installer-shell";

export default async function InstallerLayout({ children }: { children: ReactNode }) {
  await requireUser(["installer"]);

  return <InstallerShell>{children}</InstallerShell>;
}
