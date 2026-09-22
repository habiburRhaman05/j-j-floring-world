"use client";

import { useState } from "react";
import { NewLeadDialog } from "@/components/csr/new-lead-dialog";
import { useCurrentUser } from "@/components/providers/session-provider";
import { Icon } from "@/components/ui/icon";
import { useAppDb } from "@/lib/data/hooks";

const ICON_PLUS = "M12 5v14M5 12h14";

/**
 * The top bar's "New lead" action. It lives here rather than in the layout so
 * the button and the dialog it opens stay in one client component, and the
 * layout stays a plain server-renderable shell.
 */
export function NewLeadButton() {
  const db = useAppDb();
  const me = useCurrentUser();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="bar-btn"
        title="New lead"
        onClick={() => setOpen(true)}
      >
        <Icon path={ICON_PLUS} size={15} />
        <span className="lbl">New lead</span>
      </button>

      {open ? (
        <NewLeadDialog db={db} meId={me?.id ?? "u_csr"} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
