"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { RoleGuard } from "@/components/providers/session-provider";
import { activeNavKey, activeNavLabel, type NavEntry } from "@/lib/navigation";
import { AccountButton } from "./account-button";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { AppBar } from "./app-bar";
import { BottomNav } from "./bottom-nav";
import { TabStrip } from "./tab-strip";

interface WorkspaceShellProps {
  role: Role;
  /** The bold leading cell of the tab strip. */
  moduleLabel?: string;
  ariaLabel: string;
  items: NavEntry[];
  nav?: "tabs" | "bottom";
  /** The page's own actions, e.g. "New lead". */
  headerExtras?: ReactNode;
  mainClassName?: string;
  /** Optional counts for the bottom bar, keyed by destination. */
  badges?: Record<string, ReactNode>;
  children: ReactNode;
}

/**
 * The chrome every role wraps its pages in. Mounted once per role from that
 * role's layout, so switching tabs is an App Router navigation: the URL
 * changes, only the page below re-renders, and the top bar and tab strip stay
 * put.
 *
 * The active destination is read from the pathname rather than kept in state,
 * so a deep link, a browser Back and a refresh all land on the right tab.
 */
export function WorkspaceShell({
  role,
  moduleLabel = "",
  ariaLabel,
  items,
  nav = "tabs",
  headerExtras,
  mainClassName,
  badges,
  children,
}: WorkspaceShellProps) {
  return (
    <RoleGuard role={role}>
      <Shell
        role={role}
        moduleLabel={moduleLabel}
        ariaLabel={ariaLabel}
        items={items}
        nav={nav}
        headerExtras={headerExtras}
        mainClassName={mainClassName}
        badges={badges}
      >
        {children}
      </Shell>
    </RoleGuard>
  );
}

function Shell({
  role,
  moduleLabel,
  ariaLabel,
  items,
  nav,
  headerExtras,
  mainClassName,
  badges,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const active = activeNavKey(pathname, items);

  return (
    <div className="app">
      <div className="shell">
        {/* The tabbed workspaces show only the navigation row, with the page's
            actions and Account at its right. The Installer's phone layout has
            no tabs, so it keeps the top bar for its title and Account. */}
        {nav === "tabs" ? (
          <TabStrip
            moduleLabel={moduleLabel ?? ""}
            ariaLabel={ariaLabel}
            items={items}
            active={active}
            extras={
              <>
                {headerExtras}
                <AccountButton />
              </>
            }
          />
        ) : (
          <AppBar role={role} title={activeNavLabel(pathname, items)} solo extras={headerExtras} />
        )}

        <main className={cn("main", mainClassName)}>{children}</main>
      </div>

      {nav === "bottom" ? (
        <BottomNav ariaLabel={ariaLabel} items={items} active={active} badges={badges} />
      ) : null}
    </div>
  );
}
