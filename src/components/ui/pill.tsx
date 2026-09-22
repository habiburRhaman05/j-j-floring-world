import type { ReactNode } from "react";
import { STAGE_TONE } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PillProps {
  tone?: string;
  dot?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}

export function Pill({ tone, dot, className, children, title }: PillProps) {
  return (
    <span className={cn("pill", dot && "pill-dot", tone, className)} title={title}>
      {children}
    </span>
  );
}

/** A pill whose tone is looked up from the stage, status or payment state. */
export function StagePill({ stage, className }: { stage: string; className?: string }) {
  return (
    <Pill dot tone={STAGE_TONE[stage] ?? ""} className={className}>
      {stage}
    </Pill>
  );
}
