"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { usePriceBook } from "@/lib/pricebook/hooks";
import type { PriceBookItem } from "@/lib/pricebook/types";
import { money2 } from "@/lib/format";

export function AdminProducts() {
  const { data, isLoading, error } = usePriceBook();
  const products = data?.products ?? [];

  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const list = products.filter((p) => {
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      (p.description?.toLowerCase().includes(query) ?? false) ||
      (p.priceLabel?.toLowerCase().includes(query) ?? false)
    );
  });

  const columns: DataTableColumn<PriceBookItem>[] = [
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => {
        const p = row.original;
        const desc = p.description
          ? p.description.length > 80
            ? `${p.description.slice(0, 80)}…`
            : p.description
          : null;
        return (
          <>
            <div style={{ fontWeight: 500 }}>{p.name}</div>
            {p.priceLabel ? <div className="t-meta">{p.priceLabel}</div> : null}
            {desc ? <div className="t-meta">{desc}</div> : null}
          </>
        );
      },
    },
    {
      accessorKey: "unit",
      header: "Unit",
      meta: { className: "muted col-tight" },
      cell: ({ row }) => <Pill className="pill-outline">{row.original.unit}</Pill>,
    },
    {
      accessorKey: "unitPrice",
      header: "Price",
      meta: { numeric: true },
      cell: ({ row }) => money2(row.original.unitPrice),
    },
    {
      id: "compareAt",
      header: "Compare At",
      meta: { numeric: true, className: "muted" },
      accessorFn: (p) => p.compareAtPrice ?? 0,
      cell: ({ row }) => {
        const cap = row.original.compareAtPrice;
        return cap ? (
          <span style={{ textDecoration: "line-through" }}>{money2(cap)}</span>
        ) : (
          "—"
        );
      },
    },
    {
      accessorKey: "currency",
      header: "Currency",
      meta: { className: "muted col-tight" },
    },
  ];

  if (isLoading) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState title="Loading products…" message="Fetching your product catalog from GoHighLevel." />
        </PanelBody>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState
            title="Could not load products"
            message="Failed to fetch from GoHighLevel. Check your GHL connection and try again."
          />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div className="row grow" style={{ maxWidth: 480 }}>
          <Input
            type="search"
            placeholder="Search products"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <Panel>
        <PanelHead>
          <h3>Products</h3>
          <span className="t-meta">
            {list.length} of {products.length} products
          </span>
        </PanelHead>
        {list.length ? (
          <DataTable columns={columns} data={list} enableSorting />
        ) : (
          <PanelBody>
            <EmptyState title="Nothing found" message="No product matches that search." />
          </PanelBody>
        )}
      </Panel>
    </>
  );
}
