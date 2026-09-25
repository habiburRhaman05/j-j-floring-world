"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { PriceBookResponse } from "./types";

/**
 * GoHighLevel's products and prices. Fetched when the estimate builder opens
 * (and reusable for a minute), so a price changed in GHL shows up on the next
 * estimate without a restart.
 */
export function usePriceBook() {
  return useQuery({
    queryKey: ["pricebook"],
    queryFn: () => apiGet<PriceBookResponse>(endpoints.sales.products),
    staleTime: 60_000,
    refetchOnMount: true,
  });
}
