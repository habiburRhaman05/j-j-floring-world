"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useCurrentUser } from "@/components/providers/session-provider";
import { Icon, ICON_SWAP } from "@/components/ui/icon";
import { roleLabel } from "@/lib/auth/roles";
import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { AccountDialog } from "./account-dialog";

interface AppBarProps {
  role: Role;
  /** Where you are: the active destination's label. */
  title: string;
  /** The Installer has no tab strip, so its bar carries the hairline. */
  solo?: boolean;
  /** The page's own actions, e.g. "New lead". */
  extras?: ReactNode;
}

/**
 * One component dresses the top bar on every page: logo, where you are, the
 * page's own actions and the signed-in user. Destinations live in the tab
 * strip below, which is why this does not build them.
 */
export function AppBar({ role, title, solo, extras }: AppBarProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const user = useCurrentUser();
  const label = roleLabel(role);

  return (
    <header className={cn("appbar", solo && "appbar-solo")}>
      <Link className="bar-logo" href="/" aria-label="J&J Flooring World">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/jj-logo.png" alt="J&J Flooring World" />
      </Link>

      <span className="bar-rule" />

      <div className="crumb-wrap">
        <div className="crumb">{title}</div>
        <div className="crumb-sub">
          {label}
          {user ? `, ${user.name}` : ""}
        </div>
      </div>

      <span className="spacer" />

      {extras}

      <button
        type="button"
        className="bar-btn"
        title="Account and sign out"
        onClick={() => setAccountOpen(true)}
      >
        <Icon path={ICON_SWAP} size={15} />
        <span className="lbl">Account</span>
      </button>

      <span className="bar-rule" />

      <div className="bar-user" title={`${user?.name ?? "Not signed in"}, ${label}`}>
        <span className="bar-avatar">{initialsOf(user?.name)}</span>
      </div>

      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
    </header>
  );
}
