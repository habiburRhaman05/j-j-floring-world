import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The design system already owns the button look in components.css; these
 * variants only choose which of those classes applies, so every call site
 * reads `<Button variant="primary" size="sm">` instead of hand-writing
 * `"btn btn-primary btn-sm"`.
 */
export const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: "",
      primary: "btn-primary",
      go: "btn-go",
      danger: "btn-danger",
      ghost: "btn-ghost",
    },
    size: {
      default: "",
      sm: "btn-sm",
      lg: "btn-lg",
    },
    block: {
      true: "btn-block",
      false: "",
    },
  },
  defaultVariants: { variant: "default", size: "default", block: false },
});

interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a <button>, e.g. an <a>. */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...(asChild ? {} : { type: type ?? "button" })}
      {...props}
    />
  );
}
