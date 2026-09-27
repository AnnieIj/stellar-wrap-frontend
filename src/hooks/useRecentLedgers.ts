import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { horizonIndexer, RecentLedger } from '../services/horizonIndexer';
import { Network } from '../config';
import { StructuredHorizonError } from '../utils/horizonErrorHandler';

const DEFAULT_LIMIT = 20;

export function recentLedgersQueryKey(network: Network, limit: number) {
    return ['recent-ledgers', network, limit] as const;
}

export interface UseRecentLedgersResult {
    /** Cached ledgers, newest first. `undefined` until the first fetch resolves. */
    ledgers: RecentLedger[] | undefined;
    /** True only for the very first fetch (no cached data to show yet). */
    isLoading: boolean;
    /** True whenever a fetch is in flight, including background refetches. */
    isFetching: boolean;
    isError: boolean;
    error: StructuredHorizonError | null;
    /** True while a manual refresh (see `refresh`) is in flight. */
    isRefreshing: boolean;
    refreshError: StructuredHorizonError | null;
    /** Manually re-fetch, with optimistic pending state and rollback on failure. */
    refresh: () => void;
}

/**
 * Recent Stellar ledgers for `network`, cached and deduplicated by React
 * Query instead of the previous `useEffect` + local `useState` fetch.
 *
 * `refresh()` is a `useMutation`, not a plain `refetch()` call, specifically
 * to get optimistic-update semantics: clicking refresh flips `isRefreshing`
 * true synchronously (before the network round-trip resolves) so the UI can
 * react immediately, and `onError` explicitly restores the last known-good
 * cache snapshot — so a failed refresh can never leave a partial or
 * corrupted list on screen, it always rolls back cleanly to what was there
 * before. (Ledger data itself is server-authoritative and can't be
 * meaningfully predicted client-side, so the optimism here is in the UI
 * state transition, not in fabricating placeholder ledger rows.)
 */
export function useRecentLedgers(
    network: Network,
    limit: number = DEFAULT_LIMIT,
): UseRecentLedgersResult {
    const queryClient = useQueryClient();
    const queryKey = recentLedgersQueryKey(network, limit);

    const query = useQuery<RecentLedger[], StructuredHorizonError>({
        queryKey,
        queryFn: () => horizonIndexer.getLedgers(network, limit),
        // horizonQueue (src/utils/horizonRequestQueue.ts) already retries
        // transient/rate-limited Horizon failures with backoff; retrying
        // again here would just stack a second backoff on top of the first.
        retry: false,
    });

    const refreshMutation = useMutation<
        RecentLedger[],
        StructuredHorizonError,
        void,
        { previousLedgers: RecentLedger[] | undefined }
    >({
        mutationFn: () => horizonIndexer.getLedgers(network, limit),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey });
            const previousLedgers = queryClient.getQueryData<RecentLedger[]>(queryKey);
            return { previousLedgers };
        },
        onSuccess: (freshLedgers) => {
            queryClient.setQueryData(queryKey, freshLedgers);
        },
        onError: (_error, _variables, context) => {
            if (context?.previousLedgers) {
                queryClient.setQueryData(queryKey, context.previousLedgers);
            }
        },
    });

    const refresh = useCallback(() => {
        refreshMutation.mutate();
    }, [refreshMutation]);

    return {
        ledgers: query.data,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        isError: query.isError,
        error: query.error,
        isRefreshing: refreshMutation.isPending,
        refreshError: refreshMutation.error,
        refresh,
    };
}
