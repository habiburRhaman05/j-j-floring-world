"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { CheckField } from "@/components/ui/checkbox";
import { Input, Select, Textarea } from "@/components/ui/input";
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

const UNIT_LABEL: Record<Unit, string> = {
  SF: "SF - square foot",
  YD: "YD - square yard",
  LF: "LF - linear foot",
  EA: "EA - each",
  HR: "HR - hour",
  GAL: "GAL - gallon",
  BOX: "BOX - box / carton",
};

/** Waste only means something when quantity comes from a measured area. */
const AREA_UNITS: readonly Unit[] = ["SF", "YD"];

export function ProductFormDialog({ product, onClose }: ProductFormDialogProps) {
  const saveProduct = useSaveProduct();
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState<ProductCategory>(
    product?.category ?? PRODUCT_CATEGORIES[0],
  );
  const [unit, setUnit] = useState<Unit>(product?.unit ?? UNITS[0]);
  const [tier, setTier] = useState<Tier | "">(product?.tier ?? "");
  const [cost, setCost] = useState(product ? String(product.costPerUnit) : "");
  const [price, setPrice] = useState(product ? String(product.pricePerUnit) : "");
  const [targetMargin, setTargetMargin] = useState("");
  // Stored as a fraction (0.1), edited as a percent (10).
  const [waste, setWaste] = useState(
    product?.wasteFactor !== null && product?.wasteFactor !== undefined
      ? String(round2(product.wasteFactor * 100))
      : "",
  );
  const [taxable, setTaxable] = useState(product?.taxable ?? true);
  const [active, setActive] = useState(product?.active ?? true);

  const costValue = Number(cost) || 0;
  const priceValue = Number(price) || 0;
  const margin = round2(priceValue - costValue);
  const markup = costValue ? (margin / costValue) * 100 : 0;
  const isAreaUnit = AREA_UNITS.includes(unit);

  function applyTargetMargin(value: string) {
    setTargetMargin(value);
    const m = Number(value);
    if (!costValue || !Number.isFinite(m) || m <= 0 || m >= 100) return;
    setPrice(String(round2(costValue / (1 - m / 100))));
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title={product ? "Edit product" : "Add product"}
      subtitle="Name, description and price are what the customer sees on an estimate."
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
            const wastePct = waste.trim() === "" ? null : Number(waste);
            if (wastePct !== null && (!Number.isFinite(wastePct) || wastePct < 0 || wastePct > 100)) {
              toast("Waste must be between 0 and 100 percent.", "warn");
              return false;
            }
            if (priceValue < costValue) {
              toast("Heads up: this product sells below cost.", "warn", 3200);
            }
            try {
              await saveProduct.mutateAsync([
                {
                  id: product?.id ?? null,
                  name: name.trim(),
                  sku: sku.trim() || null,
                  description: description.trim() || null,
                  category,
                  unit,
                  tier: tier || null,
                  costPerUnit: cost,
                  pricePerUnit: price,
                  wasteFactor: isAreaUnit && wastePct !== null ? round2(wastePct / 100) : null,
                  taxable,
                  active,
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
      <div className="field-row">
        <Field label="Product name" style={{ flex: "2 1 240px" }}>
          <Input
            value={name}
            placeholder="e.g. Shaw Bellera 60 oz Carpet"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="SKU (optional)" className="grow">
          <Input
            value={sku}
            placeholder="CPT-BER-4200"
            onChange={(event) => setSku(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Description shown to the customer">
        <Textarea
          rows={2}
          value={description}
          placeholder="Fiber, finish, thickness, warranty, colour range..."
          onChange={(event) => setDescription(event.target.value)}
        />
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
                {UNIT_LABEL[u]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Suggested package" className="grow">
          <Select
            value={tier}
            onChange={(event) => setTier(event.target.value as Tier | "")}
          >
            <option value="">Any package</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="field-row">
        <Field label={`Cost per ${unit}`} className="grow">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
          />
        </Field>
        <Field label="Target margin %" className="grow">
          <Input
            type="number"
            step="1"
            min="0"
            max="99"
            placeholder="Sets price"
            value={targetMargin}
            onChange={(event) => applyTargetMargin(event.target.value)}
          />
        </Field>
        <Field label={`Price per ${unit}`} className="grow">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
              setTargetMargin("");
            }}
          />
        </Field>
      </div>

      <div className="margin-strip">
        <div>
          <span className="t-meta">Margin</span>
          <strong style={{ color: margin < 0 ? "var(--clay)" : "var(--moss)" }}>
            {money2(margin)}
          </strong>
        </div>
        <div>
          <span className="t-meta">Margin %</span>
          <strong>{priceValue ? pct((margin / priceValue) * 100) : "-"}</strong>
        </div>
        <div>
          <span className="t-meta">Markup</span>
          <strong>{costValue ? pct(markup) : "-"}</strong>
        </div>
      </div>

      <div className="field-row">
        <Field label="Waste allowance %" className="grow">
          <Input
            type="number"
            step="1"
            min="0"
            max="100"
            placeholder={isAreaUnit ? "e.g. 10" : "Area units only"}
            disabled={!isAreaUnit}
            value={isAreaUnit ? waste : ""}
            onChange={(event) => setWaste(event.target.value)}
          />
        </Field>
        <div
          className="field grow"
          style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 8 }}
        >
          <CheckField checked={taxable} onCheckedChange={setTaxable}>
            Charge sales tax on this item
          </CheckField>
          {product ? (
            <CheckField checked={active} onCheckedChange={setActive}>
              Active (available in the estimate builder)
            </CheckField>
          ) : null}
        </div>
      </div>

      <div className="t-meta" style={{ marginTop: -6 }}>
        Waste is added on top of the measured area when a rep fills quantities from a room
        size. Margin is computed from cost and price and is never stored.
      </div>
    </Modal>
  );
}
