"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { usePriceBook } from "@/lib/pricebook/hooks";
import type { PriceBookItem } from "@/lib/pricebook/types";
import { money2 } from "@/lib/format";

interface ProductGroup {
  productId: string;
  name: string;
  variants: PriceBookItem[];
}

function groupByProduct(items: PriceBookItem[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>();
  for (const item of items) {
    let group = map.get(item.productId);
    if (!group) {
      group = { productId: item.productId, name: item.name, variants: [] };
      map.set(item.productId, group);
    }
    group.variants.push(item);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function AdminProducts() {
  const { data, isLoading, error } = usePriceBook();
  const products = data?.products ?? [];

  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      (p.description?.toLowerCase().includes(query) ?? false) ||
      (p.priceLabel?.toLowerCase().includes(query) ?? false)
    );
  });

  const groups = groupByProduct(filtered);
  const allGroups = groupByProduct(products);

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
            {allGroups.length} product{allGroups.length === 1 ? "" : "s"},{" "}
            {products.length} variant{products.length === 1 ? "" : "s"}
          </span>
        </PanelHead>
        {groups.length ? (
          <div className="product-groups">
            {groups.map((group) => (
              <div key={group.productId} className="product-group">
                <div className="product-group-header">
                  <strong>{group.name}</strong>
                  <span className="t-meta">
                    {group.variants.length} variant{group.variants.length === 1 ? "" : "s"}
                  </span>
                </div>
                <table className="product-variants-table">
                  <thead>
                    <tr>
                      <th>Variant</th>
                      <th>Unit</th>
                      <th style={{ textAlign: "right" }}>Price</th>
                      <th style={{ textAlign: "right" }}>Compare At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.variants.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <span style={{ fontWeight: 500 }}>
                            {v.priceLabel || v.description || v.name}
                          </span>
                          {v.priceLabel && v.description && v.description !== v.priceLabel ? (
                            <div className="t-meta">
                              {v.description.length > 60
                                ? `${v.description.slice(0, 60)}…`
                                : v.description}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <Pill className="pill-outline">{v.unit}</Pill>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>
                          {money2(v.unitPrice)}
                        </td>
                        <td style={{ textAlign: "right" }} className="muted">
                          {v.compareAtPrice ? (
                            <span style={{ textDecoration: "line-through" }}>
                              {money2(v.compareAtPrice)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <PanelBody>
            <EmptyState title="Nothing found" message="No product matches that search." />
          </PanelBody>
        )}
      </Panel>
    </>
  );
}
