"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/providers/toast-provider";
import { apiGet, apiPatch } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { endpoints } from "@/lib/api/endpoints";
import type {
  CsrFbLeadsResponse,
  CsrOpportunitiesResponse,
  CsrPipelinesResponse,
} from "./types";

/* ==========================================================================
   hooks.ts  -  CSR dashboard data, read live from GoHighLevel
   --------------------------------------------------------------------------
   The app-wide QueryClient never refetches on its own (its data used to live
   in memory). GHL is the source of truth here and its workflow moves cards
   while the page is open, so these queries opt back in: a fresh fetch on
   every page load and whenever the tab regains focus.
   ========================================================================== */

const LIVE = {
  staleTime: 0,
  refetchOnMount: "always",
  refetchOnWindowFocus: true,
} as const;

export const csrKeys = {
  pipelines: ["csr", "pipelines"] as const,
  opportunities: (pipelineId: string) => ["csr", "opportunities", pipelineId] as const,
  fbLeads: ["csr", "fb-leads"] as const,
};

export function useCsrPipelines() {
  return useQuery({
    queryKey: csrKeys.pipelines,
    queryFn: () => apiGet<CsrPipelinesResponse>(endpoints.csr.pipelines),
    ...LIVE,
  });
}

export function useBoardOpportunities(pipelineId: string | null) {
  return useQuery({
    queryKey: csrKeys.opportunities(pipelineId ?? ""),
    queryFn: () => apiGet<CsrOpportunitiesResponse>(endpoints.csr.opportunities(pipelineId!)),
    enabled: Boolean(pipelineId),
    ...LIVE,
  });
}

export function useFbLeadContacts() {
  return useQuery({
    queryKey: csrKeys.fbLeads,
    queryFn: () => apiGet<CsrFbLeadsResponse>(endpoints.csr.fbLeads),
    ...LIVE,
  });
}

interface MoveVariables {
  opportunityId: string;
  pipelineId: string;
  stageId: string;
}

/**
 * Drag-and-drop stage change. The card moves on screen straight away, the
 * change is written to GHL, and if GHL refuses it the card snaps back and the
 * reason is shown. Either way the column is re-read from GHL afterwards so the
 * board always ends up showing what GHL actually holds.
 */
export function useMoveOpportunity() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ opportunityId, pipelineId, stageId }: MoveVariables) =>
      apiPatch<{ ok: true }>(endpoints.csr.moveStage(opportunityId), { pipelineId, stageId }),

    onMutate: async ({ opportunityId, pipelineId, stageId }) => {
      const key = csrKeys.opportunities(pipelineId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CsrOpportunitiesResponse>(key);
      queryClient.setQueryData<CsrOpportunitiesResponse>(key, (current) =>
        current
          ? {
              ...current,
              opportunities: current.opportunities.map((o) =>
                o.id === opportunityId ? { ...o, stageId } : o,
              ),
            }
          : current,
      );
      return { previous, key };
    },

    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
      toast(`Not moved: ${toApiError(error).displayMessage}`, "warn", 5200);
    },

    onSettled: (_data, _error, { pipelineId }) =>
      queryClient.invalidateQueries({ queryKey: csrKeys.opportunities(pipelineId) }),
  });
}
