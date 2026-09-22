"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { toApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button, type buttonVariants } from "./button";
import type { VariantProps } from "class-variance-authority";

export interface ModalAction {
  label: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  /** Keep the dialog open after the handler runs (e.g. validation failed). */
  keep?: boolean;
  /**
   * Return `false` to keep the dialog open. Async handlers are awaited, so a
   * save that writes through the API holds the foot button in its pressed
   * state until the write resolves.
   */
  onClick?: (close: () => void) => boolean | void | Promise<boolean | void>;
}

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** The estimate builder and invoice views need the extra width. */
  wide?: boolean;
  /** Disable close-on-outside-click for long forms. */
  sticky?: boolean;
  actions?: ModalAction[];
  className?: string;
  children: ReactNode;
}

/**
 * Radix Dialog supplies the focus trap, scroll lock, Escape handling and
 * outside-click dismissal. The rendered markup keeps the prototype's
 * `.scrim` / `.modal` classes so nothing about the look changes.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  subtitle,
  wide,
  sticky,
  actions,
  className,
  children,
}: ModalProps) {
  const close = () => onOpenChange(false);
  const { toast } = useToast();

  /**
   * Runs an action and closes unless it asked to stay open. A handler that
   * writes through the API is awaited; a failure is reported here, once, and
   * leaves the dialog open so the work is not lost.
   */
  async function runAction(action: ModalAction) {
    try {
      const result = await action.onClick?.(close);
      if (!action.keep && result !== false) close();
    } catch (error) {
      toast(toApiError(error).displayMessage, "warn", 4600);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="scrim">
          <DialogPrimitive.Content
            className={cn("modal", wide && "wide", className)}
            onInteractOutside={(event) => {
              if (sticky) event.preventDefault();
            }}
          >
            <div className="modal-head">
              <div>
                <DialogPrimitive.Title asChild>
                  <h3>{title}</h3>
                </DialogPrimitive.Title>
                {subtitle ? <div className="t-meta">{subtitle}</div> : null}
              </div>
              <DialogPrimitive.Close className="x-btn" aria-label="Close">
                &times;
              </DialogPrimitive.Close>
            </div>

            <DialogPrimitive.Description className="sr-only">
              {typeof subtitle === "string"
                ? subtitle
                : typeof title === "string"
                  ? title
                  : "Dialog"}
            </DialogPrimitive.Description>

            <div className="modal-body">{children}</div>

            {actions && actions.length ? (
              <div className="modal-foot">
                {actions.map((action) => (
                  <Button
                    key={action.label}
                    variant={action.variant}
                    onClick={() => void runAction(action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
