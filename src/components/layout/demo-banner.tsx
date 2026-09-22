"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * The prototype notice. Dismissal is per-mount now that there is no storage
 * layer: reloading brings it back, which is the honest behaviour for a
 * frontend-first build.
 */
export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="demo-banner">
      <div>
        <div>
          <strong>This is a working prototype.</strong> Data is held in memory for this
          browser tab only, and resets when you reload.
        </div>
        <div className="t-meta" style={{ marginTop: 4 }}>
          Use Account in the header to sign in as another seeded user and see the same data
          through Admin, Sales Rep, CSR and Installer eyes. Every destination has its own
          URL, so it can be shared or bookmarked.
        </div>
      </div>
      <Button size="sm" variant="ghost" className="close" onClick={() => setDismissed(true)}>
        Dismiss
      </Button>
    </div>
  );
}
