"use client";

/* ==========================================================================
   hooks.ts  -  the data access layer the components use
   --------------------------------------------------------------------------
   Components never import axios and never import the mock store. Every read is
   one query over `WorkspaceRepository.getSnapshot()`; every write is a mutation
   that calls a repository method and then invalidates that query, so all
   subscribed views redraw together — the same contract the prototype's
   renderAll() had.

   Swapping the mock for a live API is a config change (lib/api/config.ts).
   Nothing in this file or any component changes.
   ========================================================================== */

import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { getRepository, type WorkspaceRepository } from "../api/repository";
import { toApiError } from "../api/errors";
import { emptyDatabase } from "./database";
import { useToast } from "@/components/providers/toast-provider";
import type { Database, Tier } from "../types";

export const appDbKey = ["workspace"] as const;

/** The repository the app is running against, for imperative call sites. */
export function useRepository(): WorkspaceRepository {
  return getRepository();
}

export interface Workspace {
  db: Database;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * The whole workspace snapshot plus its loading state. Components derive what
 * they need with useMemo. Against the mock store the first paint is already
 * populated, so `isLoading` never flashes; against a real API it does.
 */
export function useWorkspace(): Workspace {
  const query = useQuery({
    queryKey: appDbKey,
    queryFn: () => getRepository().getSnapshot(),
    initialData: () => getRepository().getInitialSnapshot() ?? undefined,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    db: query.data ?? emptyDatabase(),
    isLoading: query.isPending,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}

/** The snapshot on its own, for the many views that only need the data. */
export function useAppDb(): Database {
  return useWorkspace().db;
}

export function useInvalidateAppDb() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: appDbKey });
}

/**
 * The repository itself, for the few flows that need the created entity back in
 * the same tick (the estimate builder sends the estimate it just saved, the sign
 * sheet reports the job it created). Callers must call `invalidate()` after a
 * write so every subscribed view redraws.
 */
export function useAppStore() {
  const invalidate = useInvalidateAppDb();
  const repository = useRepository();
  return useMemo(() => ({ store: repository, invalidate }), [repository, invalidate]);
}

/**
 * Wrap a repository method as a TanStack Query mutation. The method runs, then
 * the snapshot query is invalidated. A failure raises a toast here, once, so no
 * call site has to repeat the handling.
 */
function useRepositoryMutation<TArgs extends unknown[], TResult>(
  run: (repository: WorkspaceRepository, ...args: TArgs) => Promise<TResult>,
): UseMutationResult<TResult, Error, TArgs> {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<TResult, Error, TArgs>({
    mutationFn: (variables: TArgs) => run(getRepository(), ...variables),
    // Returned, not voided: the mutation stays pending (button spinner on)
    // until the refreshed snapshot is on screen, so nothing looks stale.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appDbKey }),
    onError: (error) => {
      toast(toApiError(error).displayMessage, "warn", 4600);
    },
  });
}

/** The no-argument flavour, so `mutate()` can be called with nothing. */
function useRepositoryAction<TResult>(
  run: (repository: WorkspaceRepository) => Promise<TResult>,
): UseMutationResult<TResult, Error, void> {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<TResult, Error, void>({
    mutationFn: () => run(getRepository()),
    // Returned, not voided: the mutation stays pending (button spinner on)
    // until the refreshed snapshot is on screen, so nothing looks stale.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appDbKey }),
    onError: (error) => {
      toast(toApiError(error).displayMessage, "warn", 4600);
    },
  });
}

/* ------------------------------------------------------------------ leads */

export function useAddLead() {
  return useRepositoryMutation((repo, fields: Parameters<WorkspaceRepository["addLead"]>[0]) =>
    repo.addLead(fields),
  );
}
export function useSetLeadStage() {
  return useRepositoryMutation(
    (repo, leadId: string, stage: Parameters<WorkspaceRepository["setLeadStage"]>[1]) =>
      repo.setLeadStage(leadId, stage),
  );
}
export function useAddLeadNote() {
  return useRepositoryMutation((repo, leadId: string, text: string, actorId?: string) =>
    repo.addLeadNote(leadId, text, actorId),
  );
}
export function useSetAppointment() {
  return useRepositoryMutation((repo, leadId: string, isoDate: string) =>
    repo.setAppointment(leadId, isoDate),
  );
}

/* --------------------------------------------------------------- products */

export function useSaveProduct() {
  return useRepositoryMutation((repo, fields: Parameters<WorkspaceRepository["saveProduct"]>[0]) =>
    repo.saveProduct(fields),
  );
}
export function useSetProductCommission() {
  return useRepositoryMutation(
    (repo, productId: string, rate: number | string | null) =>
      repo.setProductCommission(productId, rate),
  );
}
export function useToggleProduct() {
  return useRepositoryMutation((repo, productId: string) => repo.toggleProduct(productId));
}

/* ------------------------------------------------------------------ users */

export function useSaveUser() {
  return useRepositoryMutation((repo, fields: Parameters<WorkspaceRepository["saveUser"]>[0]) =>
    repo.saveUser(fields),
  );
}
export function useRemoveUser() {
  return useRepositoryMutation((repo, userId: string) => repo.removeUser(userId));
}

/* -------------------------------------------------------------- estimates */

export function useSaveEstimate() {
  return useRepositoryMutation((repo, fields: Parameters<WorkspaceRepository["saveEstimate"]>[0]) =>
    repo.saveEstimate(fields),
  );
}
export function useSendEstimate() {
  return useRepositoryMutation((repo, estimateId: string, tier: Tier) => repo.sendEstimate(estimateId, tier));
}
export function useMarkEstimateViewed() {
  return useRepositoryMutation((repo, estimateId: string) => repo.markEstimateViewed(estimateId));
}
export function useSignEstimate() {
  return useRepositoryMutation(
    (repo, estimateId: string, typedName: string, tier: Parameters<WorkspaceRepository["signEstimate"]>[2]) =>
      repo.signEstimate(estimateId, typedName, tier),
  );
}

/* ------------------------------------------------------------------- jobs */

export function useSetJobStage() {
  return useRepositoryMutation(
    (repo, jobId: string, stage: Parameters<WorkspaceRepository["setJobStage"]>[1]) =>
      repo.setJobStage(jobId, stage),
  );
}
export function useAssignInstaller() {
  return useRepositoryMutation(
    (repo, jobId: string, installerId: string | null, isoDate?: string | null) =>
      repo.assignInstaller(jobId, installerId, isoDate),
  );
}
export function useSetMaterialsReceived() {
  return useRepositoryMutation((repo, jobId: string, value: boolean) =>
    repo.setMaterialsReceived(jobId, value),
  );
}
export function useAddJobPhoto() {
  return useRepositoryMutation((repo, jobId: string, label: string, name: string) =>
    repo.addJobPhoto(jobId, label, name),
  );
}
export function useConfirmJob() {
  return useRepositoryMutation((repo, jobId: string) => repo.confirmJob(jobId));
}

/* --------------------------------------------------------------- invoices */

export function useSetPaymentStatus() {
  return useRepositoryMutation(
    (repo, invoiceId: string, status: Parameters<WorkspaceRepository["setPaymentStatus"]>[1]) =>
      repo.setPaymentStatus(invoiceId, status),
  );
}

/* ---------------------------------------------------------- demo controls */

export function useResetDemoData() {
  return useRepositoryAction((repo) => repo.resetDemoData());
}
export function useClearSyncLog() {
  return useRepositoryAction((repo) => repo.clearSyncLog());
}
export function useSimulateInboundEvent() {
  return useRepositoryAction((repo) => repo.simulateInboundEvent());
}
