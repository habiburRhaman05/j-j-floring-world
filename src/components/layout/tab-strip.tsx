"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { NavEntry } from "@/lib/navigation";

interface TabStripProps {
  /** The bold leading cell. GHL labels the module here, then lists the tabs. */
  moduleLabel: string;
  ariaLabel: string;
  items: NavEntry[];
  active: string;
  /** Right-hand actions: the page's own buttons and Account. */
  extras?: ReactNode;
}

/**
 * The same navigation pattern GHL uses for a module's sub navigation: a
 * bordered pill of tabs with a bold module label at the left and a blue
 * underline on the tab you are standing on. It scrolls sideways rather than
 * collapsing, so every destination stays one tap away on a phone.
 *
 * Destinations are real links, so each tab has a URL you can share, bookmark,
 * middle-click or open in a new tab.
 */
export function TabStrip({ moduleLabel, ariaLabel, items, active, extras }: TabStripProps) {
  return (
    <div className="subnav">
      <div className="subnav-inner">
        <nav className="tabs" aria-label={ariaLabel}>
          <span className="tabs-title">{moduleLabel}</span>
          {items.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                data-view={item.key}
                aria-current={isActive ? "page" : undefined}
                aria-selected={isActive}
                role="tab"
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {extras ? <div className="subnav-end">{extras}</div> : null}
      </div>
    </div>
  );
}
