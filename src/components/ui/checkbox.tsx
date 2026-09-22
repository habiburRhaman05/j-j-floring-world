"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A native checkbox, deliberately. The design system styles `.check input`
 * (16px box, brand-blue accent), so a custom listbox would mean re-implementing
 * that rule and the checked state by hand for no gain. The platform control is
 * already accessible and keyboard complete.
 */
export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return <input type="checkbox" className={cn(className)} {...props} />;
}

interface CheckFieldProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
}

/** A checkbox row in the prototype's `.check` layout: box, then label. */
export function CheckField({
  checked,
  onCheckedChange,
  children,
  disabled,
  ...rest
}: CheckFieldProps) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={rest["aria-label"]}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
