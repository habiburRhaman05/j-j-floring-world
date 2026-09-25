"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useAddJobPhoto } from "@/lib/data/hooks";
import { PHOTO_LABELS } from "@/lib/constants";

interface AddPhotoDialogProps {
  jobId: string;
  onClose: () => void;
}

/**
 * Placeholder capture. There is no upload backend: the filename and a label are
 * recorded so the flow is demoable end to end.
 */
export function AddPhotoDialog({ jobId, onClose }: AddPhotoDialogProps) {
  const addPhoto = useAddJobPhoto();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [label, setLabel] = useState<string>(PHOTO_LABELS[0]);
  const [name, setName] = useState(
    () => `IMG_${Math.floor(1000 + Math.random() * 8999)}.jpg`,
  );

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title="Add photo"
      subtitle="Placeholder capture, no file is uploaded in this prototype"
      actions={[
        { label: "Cancel", variant: "ghost" },
        {
          label: "Attach",
          variant: "primary",
          onClick: async () => {
            try {
              await addPhoto.mutateAsync([jobId, label, name || "photo.jpg"]);
            } catch {
              return false;
            }
            toast(`${label} photo attached.`, "ok");
          },
        },
      ]}
    >
      <Field label="Label">
        <Select value={label} onChange={(event) => setLabel(event.target.value)}>
          {PHOTO_LABELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="File name">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
    </Modal>
  );
}
