"use client";

import { Select } from "@/components/ui/input";

interface StageSelectProps<T extends string> {
  /** The current value; may sit outside `stages` for a role that sees a subset. */
  value: string;
  stages: readonly T[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}

/** A native select, styled by the design system, that moves a record's stage. */
export function StageSelect<T extends string>({
  value,
  stages,
  onChange,
  ariaLabel = "Stage",
}: StageSelectProps<T>) {
  return (
    <Select
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {stages.map((stage) => (
        <option key={stage} value={stage}>
          {stage}
        </option>
      ))}
    </Select>
  );
}
