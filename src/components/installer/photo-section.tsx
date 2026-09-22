"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { dt } from "@/lib/format";
import type { Job } from "@/lib/types";
import { AddPhotoDialog } from "./add-photo-dialog";

export function PhotoSection({ job }: { job: Job }) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="spread" style={{ marginBottom: 10 }}>
        <span className="label" style={{ margin: 0 }}>
          Job photos
        </span>
        <Button size="sm" onClick={() => setAdding(true)}>
          + Add Photo
        </Button>
      </div>

      {job.photos && job.photos.length ? (
        <div className="photo-grid">
          {job.photos.map((photo) => (
            <div key={photo.id} className="photo-chip">
              <span className="lbl">{photo.label}</span>
              <span className="tm">{dt(photo.at, true)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="t-meta">
          No photos yet. Before, progress and completion shots all help the office close the job.
        </div>
      )}

      {adding ? <AddPhotoDialog jobId={job.id} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
