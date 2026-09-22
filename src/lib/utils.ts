import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names. This is the standard shadcn utility: `clsx`
 * flattens conditionals and `twMerge` resolves conflicting Tailwind utilities
 * so a caller's class always wins over a component default.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
