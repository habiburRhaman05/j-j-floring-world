"use client";

import type { ReactNode } from "react";
import { AdminProducts } from "@/components/admin/products-view";
import { ViewSection } from "@/components/layout/view-section";
import { useAppDb } from "@/lib/data/hooks";

const SUB: ReactNode = (
  <>
    Mirrors the product lines carried on{" "}
    <a href="https://jjflooringworld.com/products" target="_blank" rel="noopener noreferrer">
      jjflooringworld.com
    </a>
    . Margin is always computed from cost and price, never stored as an editable field.
  </>
);

export default function AdminProductsPage() {
  const db = useAppDb();

  return (
    <ViewSection viewKey="products" heading="Products" sub={SUB}>
      <AdminProducts db={db} />
    </ViewSection>
  );
}
