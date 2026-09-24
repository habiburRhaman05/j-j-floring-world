"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { useSaveProduct } from "@/lib/data/hooks";
import { round2 } from "@/lib/data/pricing";
import { PRODUCT_CATEGORIES, TIERS, UNITS } from "@/lib/constants";
import { money2, pct } from "@/lib/format";
import type { Product, ProductCategory, Tier, Unit } from "@/lib/types";

interface ProductFormDialogProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductFormDialog({ product, onClose }: ProductFormDialogProps) {
  const saveProduct = useSaveProduct();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<ProductCategory>(
    product?.category ?? PRODUCT_CATEGORIES[0],
  );
  const [unit, setUnit] = useState<Unit>(product?.unit ?? UNITS[0]);
  const [tier, setTier] = useState<Tier | "">(product?.tier ?? "");
  const [cost, setCost] = useState(product ? String(product.costPerUnit) : "");
  const [price, setPrice] = useState(product ? String(product.pricePerUnit) : "");

  const costValue = Number(cost) || 0;
  const priceValue = Number(price) || 0;
  const margin = round2(priceValue - costValue);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title={product ? "Edit product" : "Add product"}
      actions={[
        { label: "Cancel", variant: "ghost" },
        {
          label: "Save",
          variant: "primary",
          keep: true,
          onClick: async (close) => {
            if (!name.trim()) {
              toast("Give the product a name.", "warn");
              return false;
            }
            try {
              await saveProduct.mutateAsync([
                {
                  id: product?.id ?? null,
                  name: name.trim(),
                  category,
                  unit,
                  tier: tier || null,
                  costPerUnit: cost,
                  pricePerUnit: price,
                },
              ]);
            } catch {
              // The mutation hook has already reported why. Stay open so the
              // half-typed product is not thrown away.
              return false;
            }
            toast("Product saved.", "ok");
            close();
          },
        },
      ]}
    >
      <Field label="Product name">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <div className="field-row">
        <Field label="Category" className="grow">
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value as ProductCategory)}
          >
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit" className="grow">
          <Select value={unit} onChange={(event) => setUnit(event.target.value as Unit)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tier" className="grow">
          <Select
            value={tier}
            onChange={(event) => setTier(event.target.value as Tier | "")}
          >
            <option value="">No tier</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="field-row">
        <Field label="Cost per unit" className="grow">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
          />
        </Field>
        <Field label="Price per unit" className="grow">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
      </div>

      <div className="t-meta" style={{ marginTop: -6 }}>
        Margin computes to {money2(margin)}
        {priceValue ? ` (${pct((margin / priceValue) * 100)})` : ""}. It is never stored or
        edited directly.
      </div>
    </Modal>
  );
}
