"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "./query-provider";
import { SessionProvider } from "./session-provider";
import { ToastProvider } from "./toast-provider";

/**
 * Provider order matters: the session resolves the signed-in user against the
 * query cache, so Query must be outermost. Toasts are innermost because the
 * session and data layers never raise one.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <SessionProvider>
        <ToastProvider>{children}</ToastProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
