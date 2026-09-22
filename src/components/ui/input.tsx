import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("input", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn("textarea", className)} {...props} />;
}

/**
 * A native select, deliberately. The design system styles the platform
 * control with its own caret, so replacing it with a custom listbox would be
 * a visible change for no gain on these short, fixed option lists.
 */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn("select", className)} {...props} />;
}
