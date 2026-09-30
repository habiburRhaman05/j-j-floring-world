"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/providers/toast-provider";
import { apiGet, apiPut } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { endpoints } from "@/lib/api/endpoints";

export interface ProductCostRow {
  /** "<ghlProductId>:<ghlPriceId>", the same id as a PriceBookItem. */
  id: string;
  installCost: number;
  materialCost: number;
}

const costsKey = ["admin", "product-costs"] as const;

/** Admin only: install + material cost per price-book item. */
export function useProductCosts() {
  return useQuery({
    queryKey: costsKey,
    queryFn: () => apiGet<{ costs: ProductCostRow[] }>(endpoints.sales.productCosts),
    staleTime: 30_000,
  });
}

export function useSaveProductCost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (input: {
      ghlProductId: string;
      ghlPriceId: string;
      installCost: number;
      materialCost: number;
    }) => apiPut<ProductCostRow>(endpoints.sales.productCosts, input),
    onSuccess: () => {
      toast("Cost saved.", "ok");
      return queryClient.invalidateQueries({ queryKey: costsKey });
    },
    onError: (error) => toast(toApiError(error).displayMessage, "warn", 5200),
  });
}
