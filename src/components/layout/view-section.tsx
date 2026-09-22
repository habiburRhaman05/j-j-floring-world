import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ViewSectionProps {
  /** Written to data-view, matching the navigation entry key. */
  viewKey: string;
  heading: string;
  /** The view-head sub line. May contain links, hence a node. */
  sub?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * One page's body. Every role page opens with this, which is what keeps the
 * heading, the sub line and the section spacing identical across all thirteen
 * destinations without repeating the markup.
 */
export function ViewSection({ viewKey, heading, sub, className, children }: ViewSectionProps) {
  return (
    <section className={cn("view is-active", className)} data-view={viewKey}>
      <div className="view-head">
        <h1>{heading}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {children}
    </section>
  );
}
