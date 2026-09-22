"use client";

import { useState } from "react";
import { EstimateBuilder } from "@/components/estimator/estimate-builder";
import { useCurrentUser } from "@/components/providers/session-provider";
import { Icon } from "@/components/ui/icon";
import { useAppDb } from "@/lib/data/hooks";

const ICON_PLUS = "M12 5v14M5 12h14";

/**
 * The top bar's "New estimate" action. It lives here rather than in the layout
 * so the button and the dialog it opens stay in one client component, and the
 * layout stays a plain server-renderable shell.
 */
export function NewEstimateButton() {
  const db = useAppDb();
  const me = useCurrentUser();
  const [builderKey, setBuilderKey] = useState<number | null>(null);

  return (
    <>
      <button
        type="button"
        className="bar-btn"
        title="New estimate"
        onClick={() => setBuilderKey(Date.now())}
      >
        <Icon path={ICON_PLUS} size={15} />
        <span className="lbl">New estimate</span>
      </button>

      {builderKey !== null ? (
        <EstimateBuilder
          key={builderKey}
          open
          onOpenChange={() => setBuilderKey(null)}
          db={db}
          role="Sales Rep"
          repId={me?.id ?? ""}
        />
      ) : null}
    </>
  );
}
