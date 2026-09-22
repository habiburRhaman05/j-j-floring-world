import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function Panel({ className, style, children }: PanelProps) {
  return (
    <div className={cn("panel", className)} style={style}>
      {children}
    </div>
  );
}

export function PanelHead({ className, children }: Omit<PanelProps, "style">) {
  return <div className={cn("panel-head", className)}>{children}</div>;
}

export function PanelBody({
  className,
  tight,
  children,
}: Omit<PanelProps, "style"> & { tight?: boolean }) {
  return <div className={cn("panel-body", tight && "tight", className)}>{children}</div>;
}

export function PanelFoot({ className, children }: Omit<PanelProps, "style">) {
  return <div className={cn("panel-foot", className)}>{children}</div>;
}
