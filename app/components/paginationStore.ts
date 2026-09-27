"use client";

import { create } from "zustand";

export interface PageResult<T> {
  items: T[];
  totalItems: number;
}

/**
 * Fetches a single page of data. Implementations may hit a network endpoint.
 */
export type PageFetcher<T> = (page: number, pageSize: number) => Promise<PageResult<T>>;

export interface PaginationState<T> {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  data: T[] | null;
  fetchPage: (page: number) => Promise<void>;
  setPageSize: (pageSize: number) => void;
  retry: () => Promise<void>;
  reset: () => void;
}

/**
 * Creates a zustand store wired to a page fetcher. Passing the fetcher in
 * allows callers (and tests) to supply a mock network implementation and to
 * create isolated stores without shared global mutation.
 */
export function createPaginationStore<T>(
  fetcher: PageFetcher<T>,
  initialPageSize = 10,
) {
  return create<PaginationState<T>>()((set, get) => ({
    currentPage: 1,
    totalPages: 0,
    pageSize: initialPageSize,
    isLoading: false,
    error: null,
    data: null,

    fetchPage: async (page: number) => {
      const { pageSize, currentPage } = get();
      const target = Math.max(1, page);
      if (target === currentPage && get().data !== null && !get().error) {
        return;
      }

      set({ isLoading: true, error: null });
      try {
        const result = await fetcher(target, pageSize);
        set({
          currentPage: target,
          data: result.items,
          totalPages: Math.max(1, Math.ceil(result.totalItems / pageSize)),
          isLoading: false,
          error: null,
        });
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : "Failed to load page";
        set({ isLoading: false, error: message, data: null });
      }
    },

    setPageSize: (pageSize: number) => {
      set({
        pageSize: Math.max(1, pageSize),
        totalPages: 0,
        data: null,
        currentPage: 1,
      });
    },

    retry: async () => {
      const { currentPage } = get();
      await get().fetchPage(currentPage);
    },

    reset: () => {
      set({
        currentPage: 1,
        totalPages: 0,
        isLoading: false,
        error: null,
        data: null,
      });
    },
  }));
}
