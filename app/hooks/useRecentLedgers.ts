"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHorizonServer } from "@/app/utils/stellarClient";

type NetworkType = "mainnet" | "testnet";

export interface Ledger {
  id: string;
  sequence: number;
  closed_at: string;
  hash: string;
  previous_hash: string;
  successful_transaction_count: number;
  failed_transaction_count: number;
  operation_count: number;
  tx_set_operation_count: number;
  base_fee_in_stroops: number;
  base_reserve_in_stroops: number;
  max_tx_set_size: number;
  protocol_version: number;
  header_xdr: string;
}

export interface RecentLedgersParams {
  network: NetworkType;
  limit?: number;
  cursor?: string;
}

export interface UseRecentLedgersResult {
  ledgers: Ledger[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}

export interface UseLedgerMutationOptions {
  onSuccess?: (data: Ledger) => void;
  onError?: (error: Error) => void;
}

/**
 * Fetches recent ledgers from Stellar Horizon API with React Query caching
 * 
 * @param params - Configuration for fetching recent ledgers
 * @returns React Query result with ledger data and loading states
 */
export function useRecentLedgers(
  params: RecentLedgersParams
): UseRecentLedgersResult {
  const { network, limit = 10, cursor } = params;

  const queryKey = ["recent-ledgers", network, limit, cursor] as const;

  const {
    data: ledgers,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const server = getHorizonServer(network);
      const ledgersCall = server.ledgers();
      
      if (cursor) {
        ledgersCall.cursor(cursor);
      }
      
      ledgersCall.limit(limit);
      ledgersCall.order("desc");

      const response = await ledgersCall.call();
      return response.records as Ledger[];
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    refetchOnWindowFocus: false,
  });

  const hasNextPage = ledgers && ledgers.length === limit;

  const fetchNextPage = () => {
    if (hasNextPage && ledgers) {
      const lastLedger = ledgers[ledgers.length - 1];
      if (lastLedger) {
        refetch();
      }
    }
  };

  return {
    ledgers,
    isLoading,
    error: error as Error | null,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage: isLoading,
  };
}

/**
 * Hook for mutating ledger data with optimistic updates
 * 
 * @param options - Callback options for success/error handling
 * @returns Mutation functions for ledger operations
 */
export function useLedgerMutation(options?: UseLedgerMutationOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (ledgerId: string) => {
      const network = "mainnet" as NetworkType; // Default to mainnet for now
      const server = getHorizonServer(network);
      const response = await server.ledgers().ledger(ledgerId).call();
      return response as Ledger;
    },
    onMutate: async (ledgerId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["recent-ledgers"] });

      // Snapshot previous value
      const previousLedgers = queryClient.getQueryData<Ledger[]>(["recent-ledgers"]);

      // Optimistically update to the new value
      queryClient.setQueryData<Ledger[]>(["recent-ledgers"], (old) => {
        if (!old) return old;
        return old.map((ledger) =>
          ledger.id === ledgerId
            ? { ...ledger, successful_transaction_count: ledger.successful_transaction_count + 1 }
            : ledger
        );
      });

      // Return context with previous value
      return { previousLedgers };
    },
    onError: (error, ledgerId, context) => {
      // Rollback to previous value on error
      if (context?.previousLedgers) {
        queryClient.setQueryData(["recent-ledgers"], context.previousLedgers);
      }
      options?.onError?.(error as Error);
    },
    onSettled: () => {
      // Refetch to ensure server state is correct
      queryClient.invalidateQueries({ queryKey: ["recent-ledgers"] });
    },
    onSuccess: (data) => {
      options?.onSuccess?.(data);
    },
  });

  return {
    mutateLedger: mutation.mutate,
    mutateLedgerAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
  };
}

/**
 * Prefetch recent ledgers data for better performance
 * 
 * @param params - Configuration for prefetching
 * @param queryClient - QueryClient instance for prefetching
 */
export function prefetchRecentLedgers(
  params: RecentLedgersParams,
  queryClient: ReturnType<typeof useQueryClient>
) {
  return queryClient.prefetchQuery({
    queryKey: ["recent-ledgers", params.network, params.limit, params.cursor],
    queryFn: async () => {
      const server = getHorizonServer(params.network);
      const ledgersCall = server.ledgers();
      
      if (params.cursor) {
        ledgersCall.cursor(params.cursor);
      }
      
      ledgersCall.limit(params.limit);
      ledgersCall.order("desc");

      const response = await ledgersCall.call();
      return response.records as Ledger[];
    },
    staleTime: 30 * 1000,
  });
}