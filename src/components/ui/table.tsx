import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function TableWrap({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("table-wrap", className)} {...props} />;
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("grid", className)} {...props} />;
}

export function THead(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}

export function TBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

export function TFoot(props: ComponentProps<"tfoot">) {
  return <tfoot {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn(className)} {...props} />;
}

interface CellProps extends ComponentProps<"th"> {
  /** Right-align and use tabular figures, for money and counts. */
  numeric?: boolean;
}

export function Th({ className, numeric, ...props }: CellProps) {
  return <th className={cn(numeric && "num", className)} {...props} />;
}

export function Td({ className, numeric, ...props }: CellProps) {
  return <td className={cn(numeric && "num", className)} {...props} />;
}

/** A full-width total row, as the invoice line table uses. */
export function TotalRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn(className)} style={{ background: "var(--panel-sunk)" }} {...props} />;
}
