"use client";

import { useState } from "react";
import { useCurrentUser } from "@/components/providers/session-provider";
import { Icon, ICON_SWAP } from "@/components/ui/icon";
import { AccountDialog } from "./account-dialog";

/** Opens the account dialog: profile, password change and sign out. */
export function AccountButton() {
  const [open, setOpen] = useState(false);
  const user = useCurrentUser();

  return (
    <>
      <button
        type="button"
        className="bar-btn"
        title={user ? `${user.name}: account, password and sign out` : "Account and sign out"}
        onClick={() => setOpen(true)}
      >
        <Icon path={ICON_SWAP} size={15} />
        <span className="lbl">Account</span>
      </button>
      <AccountDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
