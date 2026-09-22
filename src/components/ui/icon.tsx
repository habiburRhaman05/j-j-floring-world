import type { SVGProps } from "react";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "d"> {
  /** SVG path data, drawn on the shared 24x24 grid. */
  path: string;
  size?: number;
  strokeWidth?: number;
}

/** The one icon primitive: a single stroked path on a 24x24 viewBox. */
export function Icon({ path, size, strokeWidth = 1.8, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...(size ? { width: size, height: size } : {})}
      {...props}
    >
      <path d={path} />
    </svg>
  );
}

/** Path data reused by more than one component. */
export const ICON_SWAP = "M7 4v13m0 0l-3-3m3 3l3-3M17 20V7m0 0l3 3m-3-3l-3 3";
