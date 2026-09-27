"use client";

import { useCallback, useState } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import {
  createPaginationStore,
  type PaginationState,
  type PageFetcher,
} from "./paginationStore";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Default fetcher used when no page fetcher is supplied. In a real integration
 * this would call a network endpoint; here it resolves to an empty page so the
 * hook remains usable in isolation.
 */
const emptyFetcher: PageFetcher<unknown> = async () => ({
  items: [],
  totalItems: 0,
});

export interface UsePaginationControllerOptions<T> {
  fetcher?: PageFetcher<T>;
  pageSize?: number;
  store?: StoreApi<PaginationState<T>>;
}

export interface PaginationController<T> extends PaginationState<T> {
  goToPage: (page: number) => void;
}

/**
 * Bridges a pagination store (global state backed by a page fetcher that may
 * hit the network) with {@link Pagination}. A stable store instance is kept so
 * the component does not lose its state across renders.
 */
export function usePaginationController<T>(options: UsePaginationControllerOptions<T> = {}) {
  const { fetcher, pageSize = DEFAULT_PAGE_SIZE, store: externalStore } = options;

  const resolvedFetcher = (fetcher ?? emptyFetcher) as PageFetcher<T>;

  const [internalStore] = useState<StoreApi<PaginationState<T>>>(() =>
    createPaginationStore(resolvedFetcher, pageSize),
  );

  const store = externalStore ?? internalStore;

  const currentPage = useStore(store, (s) => s.currentPage);
  const totalPages = useStore(store, (s) => s.totalPages);
  const pageSizeValue = useStore(store, (s) => s.pageSize);
  const isLoading = useStore(store, (s) => s.isLoading);
  const error = useStore(store, (s) => s.error);
  const data = useStore(store, (s) => s.data);

  const fetchPage = useStore(store, (s) => s.fetchPage);
  const setPageSize = useStore(store, (s) => s.setPageSize);
  const retry = useStore(store, (s) => s.retry);
  const reset = useStore(store, (s) => s.reset);

  const goToPage = useCallback(
    (page: number) => {
      void fetchPage(page);
    },
    [fetchPage],
  );

  return {
    currentPage,
    totalPages,
    pageSize: pageSizeValue,
    isLoading,
    error,
    data,
    fetchPage,
    setPageSize,
    retry,
    reset,
    goToPage,
  } as PaginationController<T>;
}
