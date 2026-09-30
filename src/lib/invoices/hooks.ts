"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { InvoiceListResponse } from "./types";

/** GHL invoices with live status. Read fresh on every load so a payment shows up. */
export function useInvoices() {
  return useQuery({
    queryKey: ["invoices", "list"],
    queryFn: () => apiGet<InvoiceListResponse>(endpoints.invoices.list),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}
