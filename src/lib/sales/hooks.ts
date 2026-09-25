"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/providers/toast-provider";
import { apiGet, apiPatch, apiPut } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { endpoints } from "@/lib/api/endpoints";
import type { SalesBoardResponse, SalesRates } from "./types";

/* ==========================================================================
   hooks.ts  -  the GHL Sales Pipeline, for the admin and rep dashboards
   Read fresh from GHL on every page load and when the tab regains focus;
   after a stage change the board is re-read so it shows what GHL holds.
   ========================================================================== */

export const salesBoardKey = ["sales", "board"] as const;

export function useSalesBoard() {
  return useQuery({
    queryKey: salesBoardKey,
    queryFn: () => apiGet<SalesBoardResponse>(endpoints.sales.board),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

/** Optimistic move, pushed to GHL, rolled back with the reason if GHL refuses, then re-read. */
export function useMoveSalesOpportunity() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ opportunityId, stageId }: { opportunityId: string; stageId: string }) =>
      apiPatch<{ ok: true }>(endpoints.sales.moveStage(opportunityId), { stageId }),

    onMutate: async ({ opportunityId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: salesBoardKey });
      const previous = queryClient.getQueryData<SalesBoardResponse>(salesBoardKey);
      queryClient.setQueryData<SalesBoardResponse>(salesBoardKey, (current) =>
        current
          ? {
              ...current,
              opportunities: current.opportunities.map((o) =>
                o.id === opportunityId ? { ...o, stageId } : o,
              ),
            }
          : current,
      );
      return { previous };
    },

    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(salesBoardKey, context.previous);
      toast(`Not moved: ${toApiError(error).displayMessage}`, "warn", 5200);
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: salesBoardKey }),
  });
}

export function useSaveSalesRates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (rates: Required<{ [K in keyof SalesRates]: NonNullable<SalesRates[K]> }>) =>
      apiPut<SalesRates>(endpoints.sales.rates, rates),
    onSuccess: () => {
      toast("Rates saved. Commission and margin are recalculated.", "ok");
      return queryClient.invalidateQueries({ queryKey: salesBoardKey });
    },
    onError: (error) => toast(toApiError(error).displayMessage, "warn", 5200),
  });
}
