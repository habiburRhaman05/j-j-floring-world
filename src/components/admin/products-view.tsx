"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { CheckField } from "@/components/ui/checkbox";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { useToggleProduct } from "@/lib/data/hooks";
import { round2 } from "@/lib/data/pricing";
import { money2, pct } from "@/lib/format";
import type { Database, Product } from "@/lib/types";
import { ProductFormDialog } from "./product-form-dialog";

export function AdminProducts({ db }: { db: Database }) {
  const toggleProduct = useToggleProduct();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<{ open: boolean; productId: string | null }>({
    open: false,
    productId: null,
  });

  const query = search.trim().toLowerCase();
  const list = db.products.filter((p) => {
    if (!showInactive && !p.active) return false;
    if (
      query &&
      !p.name.toLowerCase().includes(query) &&
      !p.category.toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  });

  const marginOf = (p: Product) => round2(p.pricePerUnit - p.costPerUnit);

  const columns: DataTableColumn<Product>[] = [
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => (
        <>
          <div style={{ fontWeight: 500 }}>{row.original.name}</div>
          <div className="t-meta">{row.original.tier ? `${row.original.tier} tier` : ""}</div>
        </>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => <Pill className="pill-outline">{row.original.category}</Pill>,
    },
    {
      accessorKey: "unit",
      header: "Unit",
      meta: { className: "muted" },
    },
    {
      accessorKey: "costPerUnit",
      header: "Cost",
      meta: { numeric: true },
      cell: ({ row }) => money2(row.original.costPerUnit),
    },
    {
      accessorKey: "pricePerUnit",
      header: "Price",
      meta: { numeric: true },
      cell: ({ row }) => money2(row.original.pricePerUnit),
    },
    {
      id: "margin",
      header: "Margin",
      meta: { numeric: true },
      accessorFn: (p) => marginOf(p),
      cell: ({ row }) => (
        <span style={{ color: "var(--moss)", fontWeight: 600 }}>
          {money2(marginOf(row.original))}
        </span>
      ),
    },
    {
      id: "marginPct",
      header: "Margin %",
      meta: { numeric: true, className: "muted" },
      accessorFn: (p) => (p.pricePerUnit ? (marginOf(p) / p.pricePerUnit) * 100 : 0),
      cell: ({ row }) =>
        pct(row.original.pricePerUnit ? (marginOf(row.original) / row.original.pricePerUnit) * 100 : 0),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="row">
          <Button
            size="sm"
            onClick={() => setForm({ open: true, productId: row.original.id })}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              toggleProduct.mutate([row.original.id]);
              toast(`Product ${row.original.active ? "deactivated" : "activated"}.`);
            }}
          >
            {row.original.active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  const editingProduct = form.productId
    ? (db.products.find((p) => p.id === form.productId) ?? null)
    : null;

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
        <div className="row">
          <CheckField
            checked={showInactive}
            aria-label="Show inactive products"
            onCheckedChange={setShowInactive}
          >
            Show inactive
          </CheckField>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setForm({ open: true, productId: null })}
          >
            Add product
          </Button>
        </div>
      </div>

      <Panel>
        <PanelHead>
          <h3>Products</h3>
          <span className="t-meta">
            {list.length} of {db.products.length} products
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

      {form.open ? (
        <ProductFormDialog
          product={editingProduct}
          onClose={() => setForm({ open: false, productId: null })}
        />
      ) : null}
    </>
  );
}
