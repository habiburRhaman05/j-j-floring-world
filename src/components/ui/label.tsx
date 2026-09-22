import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn("label", className)} {...props} />;
}

interface FieldProps {
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}

/** A labelled form row. The wrapper owns the spacing, not the control. */
export function Field({ label, className, style, children }: FieldProps) {
  return (
    <label className={cn("field", className)} style={style}>
      {label ? <span className="label">{label}</span> : null}
      {children}
    </label>
  );
}
