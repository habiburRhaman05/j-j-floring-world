"use client";

import * as Toast from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ToastTone = "" | "ok" | "warn";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  ms: number;
}

interface ToastApi {
  /** Matches the prototype's UI.toast(message, tone, ms). */
  toast: (message: string, tone?: ToastTone, ms?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 0;

/**
 * Toasts are raised through Radix Toast, which brings pause-on-hover, swipe to
 * dismiss and screen-reader announcements, while the markup keeps the original
 * `.toast-dock` / `.toast` classes so the visual design is unchanged.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = "", ms = 3200) => {
    nextId += 1;
    const id = nextId;
    setItems((prev) => [...prev, { id, message, tone, ms }]);
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      <Toast.Provider swipeDirection="down" duration={3200}>
        {children}
        {items.map((item) => (
          <Toast.Root
            key={item.id}
            className={cn("toast", item.tone)}
            duration={item.ms}
            onOpenChange={(open) => {
              if (!open) remove(item.id);
            }}
          >
            <span className="mark" aria-hidden="true" />
            <Toast.Description className="txt">{item.message}</Toast.Description>
          </Toast.Root>
        ))}
        <Toast.Viewport className="toast-dock" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
