"use client";

import type { ReactNode } from "react";
import { AdminProducts } from "@/components/admin/products-view";
import { ViewSection } from "@/components/layout/view-section";

const SUB: ReactNode = (
  <>
    Products and prices synced from{" "}
    <a href="https://app.gohighlevel.com" target="_blank" rel="noopener noreferrer">
      GoHighLevel
    </a>
    . Manage your product catalog in GHL — changes appear here automatically.
  </>
);

export default function AdminProductsPage() {
  return (
    <ViewSection viewKey="products" heading="Products" sub={SUB}>
      <AdminProducts />
    </ViewSection>
  );
}
