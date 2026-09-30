"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { money2, pct } from "@/lib/format";
import { useProductCosts, useSaveProductCost, type ProductCostRow } from "@/lib/pricebook/cost-hooks";
import { usePriceBook } from "@/lib/pricebook/hooks";
import type { PriceBookItem } from "@/lib/pricebook/types";

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

const cell = { padding: "8px 12px" } as const;
const num = { textAlign: "right", ...cell } as const;

function VariantRow({ item, cost }: { item: PriceBookItem; cost: ProductCostRow | undefined }) {
  const save = useSaveProductCost();
  const savedInstall = String(cost?.installCost ?? 0);
  const savedMaterial = String(cost?.materialCost ?? 0);
  const [install, setInstall] = useState(savedInstall);
  const [material, setMaterial] = useState(savedMaterial);

  const installValue = Math.max(Number(install) || 0, 0);
  const materialValue = Math.max(Number(material) || 0, 0);
  const totalCost = installValue + materialValue;
  const margin = item.unitPrice - totalCost;
  const marginPct = item.unitPrice > 0 ? (margin / item.unitPrice) * 100 : 0;
  const dirty = install !== savedInstall || material !== savedMaterial;
  const hasCost = totalCost > 0;

  return (
    <tr>
      <td style={cell}>
        <span style={{ fontWeight: 500 }}>{item.priceLabel || item.description || item.name}</span>
      </td>
      <td style={cell}>
        <Pill className="pill-outline">{item.unit}</Pill>
      </td>
      <td style={{ ...num, fontWeight: 600 }}>{money2(item.unitPrice)}</td>
      <td style={num}>
        <Input
          type="number"
          min={0}
          step={0.01}
          aria-label="Install cost"
          style={{ width: 96, textAlign: "right" }}
          value={install}
          onChange={(event) => setInstall(event.target.value)}
        />
      </td>
      <td style={num}>
        <Input
          type="number"
          min={0}
          step={0.01}
          aria-label="Material cost"
          style={{ width: 96, textAlign: "right" }}
          value={material}
          onChange={(event) => setMaterial(event.target.value)}
        />
      </td>
      <td style={num}>{money2(totalCost)}</td>
      <td style={{ ...num, color: hasCost ? "var(--moss)" : undefined, fontWeight: 600 }}>
        {hasCost ? money2(margin) : "-"}
      </td>
      <td style={num} className="muted">
        {hasCost ? pct(marginPct) : "-"}
      </td>
      <td style={cell}>
        <Button
          size="sm"
          variant={dirty ? "primary" : "ghost"}
          disabled={!dirty}
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              ghlProductId: item.productId,
              ghlPriceId: item.priceId,
              installCost: installValue,
              materialCost: materialValue,
            })
          }
        >
          Save
        </Button>
      </td>
    </tr>
  );
}

export function AdminProducts() {
  const { data, isLoading, error } = usePriceBook();
  const costs = useProductCosts();
  const products = data?.products ?? [];
  const costById = new Map((costs.data?.costs ?? []).map((c) => [c.id, c] as const));

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

  if (isLoading || costs.isLoading) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState title="Loading products…" message="Fetching your product catalog from GoHighLevel." />
        </PanelBody>
      </Panel>
    );
  }

  if (error || costs.error) {
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
          <div>
            <h3>Products</h3>
            <div className="t-meta">
              Sell price comes from GoHighLevel. Enter install and material cost per unit; margin is
              worked out from them. Costs are never shown to sales reps or sent to GHL.
            </div>
          </div>
          <span className="t-meta">
            {allGroups.length} product{allGroups.length === 1 ? "" : "s"}, {products.length} variant
            {products.length === 1 ? "" : "s"}
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
                <div style={{ overflowX: "auto" }}>
                  <table className="product-variants-table">
                    <thead>
                      <tr>
                        <th>Variant</th>
                        <th>Unit</th>
                        <th style={{ textAlign: "right" }}>Sell price</th>
                        <th style={{ textAlign: "right" }}>Install cost</th>
                        <th style={{ textAlign: "right" }}>Material cost</th>
                        <th style={{ textAlign: "right" }}>Total cost</th>
                        <th style={{ textAlign: "right" }}>Margin</th>
                        <th style={{ textAlign: "right" }}>Margin %</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {group.variants.map((v) => (
                        <VariantRow
                          key={`${v.id}:${costById.get(v.id)?.installCost}:${costById.get(v.id)?.materialCost}`}
                          item={v}
                          cost={costById.get(v.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
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
