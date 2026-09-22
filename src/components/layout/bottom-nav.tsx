"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import type { NavEntry } from "@/lib/navigation";

interface BottomNavProps {
  ariaLabel: string;
  items: NavEntry[];
  active: string;
  /** Optional count rendered bold after the label, keyed by destination. */
  badges?: Record<string, ReactNode>;
}

/**
 * The Installer never gets a tab strip. It keeps a full-width bottom tab bar
 * on phones, which becomes a centred floating dock from 768px up.
 */
export function BottomNav({ ariaLabel, items, active, badges }: BottomNavProps) {
  return (
    <nav className="bottombar" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.key === active;
        const badge = badges?.[item.key];
        return (
          <Link
            key={item.key}
            href={item.href}
            data-view={item.key}
            data-title={item.label}
            aria-current={isActive ? "page" : undefined}
            aria-selected={isActive}
            role="tab"
          >
            <Icon path={item.icon ?? ""} strokeWidth={1.7} />
            <span>
              {item.label}
              {badge ? <b> {badge}</b> : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
