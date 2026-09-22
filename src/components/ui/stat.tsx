import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: string;
  note?: string;
  tone?: "" | "good" | "warn" | "gold";
}

/** One cell of the ledger strip: label, value, optional note. */
export function Stat({ label, value, note, tone = "" }: StatProps) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={cn("stat-value", tone)}>{value}</div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  );
}

/** The strip reads as a ledger, not as a row of identical cards. */
export function StatStrip({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={cn("stat-strip", className)} style={style}>
      {children}
    </div>
  );
}
