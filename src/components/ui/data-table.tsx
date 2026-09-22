"use client";

import {
  createSortedRowModel,
  metaHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Per-column presentation flags, read off the column definition's meta. */
export interface ColumnMetaFlags {
  /** Right-align and use tabular figures. */
  numeric?: boolean;
  className?: string;
}

/**
 * Only the feature these tables actually use is registered, so nothing else
 * reaches the bundle. Row-model factories live in the feature slots in v9
 * rather than as table options.
 */
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnMeta: metaHelper<ColumnMetaFlags>(),
});

export type DataTableColumn<TData extends RowData> = ColumnDef<typeof features, TData>;

interface DataTableProps<TData extends RowData> {
  columns: DataTableColumn<TData>[];
  data: TData[];
  /** Adds a click-to-sort header. Sorting starts off, so the table looks the same. */
  enableSorting?: boolean;
  empty?: ReactNode;
  className?: string;
}

/**
 * TanStack Table drives the row and column model; the markup it renders is the
 * project's own `.table-wrap` / `table.grid` structure, so the visual design is
 * untouched while sorting (and later filtering and pagination) come from the
 * library.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  enableSorting = false,
  empty,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useTable({
    features,
    columns,
    data,
    state: { sorting },
    onSortingChange: setSorting,
  });

  const rows = table.getRowModel().rows;

  return (
    <div className={cn("table-wrap", className)}>
      <table className="grid">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const canSort = enableSorting && header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                const content = header.isPlaceholder ? null : <table.FlexRender header={header} />;

                return (
                  <th key={header.id} className={cn(meta?.numeric && "num", meta?.className)}>
                    {canSort ? (
                      <button
                        type="button"
                        className="th-sort"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {content}
                        {sorted ? (
                          <span className="th-caret" aria-hidden="true">
                            {sorted === "asc" ? "\u25B2" : "\u25BC"}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      content
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.getAllCells().map((cell) => {
                const meta = cell.column.columnDef.meta;
                return (
                  <td key={cell.id} className={cn(meta?.numeric && "num", meta?.className)}>
                    <table.FlexRender cell={cell} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && empty ? <div className="panel-body">{empty}</div> : null}
    </div>
  );
}
