/**
 * Unit tests for the pagination zustand store.
 *
 * The store is the "global state" layer backed by a page fetcher that may hit
 * the network. These tests mock the fetcher to verify happy paths, error
 * paths, retry, deduplication, page-size changes, and reset behaviour.
 */

import { createPaginationStore, type PageFetcher } from "../paginationStore";

type Item = { id: number };

describe("createPaginationStore", () => {
  let fetcher: jest.Mock<Promise<{ items: Item[]; totalItems: number }>>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetcher = jest.fn();
  });

  const makeStore = (pageSize = 10) => createPaginationStore<Item>(fetcher, pageSize);

  describe("initial state", () => {
    it("starts on page 1 with no data and no error", () => {
      fetcher.mockResolvedValue({ items: [], totalItems: 0 });
      const store = makeStore();
      const state = store.getState();
      expect(state.currentPage).toBe(1);
      expect(state.totalPages).toBe(0);
      expect(state.data).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.pageSize).toBe(10);
    });

    it("uses a custom initial page size", () => {
      fetcher.mockResolvedValue({ items: [], totalItems: 0 });
      const store = makeStore(25);
      expect(store.getState().pageSize).toBe(25);
    });
  });

  describe("fetchPage (happy path)", () => {
    it("stores items and computes total pages from total items", async () => {
      fetcher.mockResolvedValue({
        items: [{ id: 1 }, { id: 2 }],
        totalItems: 42,
      });
      const store = makeStore(10);
      await store.getState().fetchPage(2);

      expect(fetcher).toHaveBeenCalledWith(2, 10);
      const state = store.getState();
      expect(state.currentPage).toBe(2);
      expect(state.data).toEqual([{ id: 1 }, { id: 2 }]);
      expect(state.totalPages).toBe(5); // ceil(42 / 10)
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("clamps a requested page below 1 to page 1", async () => {
      fetcher.mockResolvedValue({ items: [], totalItems: 30 });
      const store = makeStore(10);
      await store.getState().fetchPage(-3);
      expect(fetcher).toHaveBeenCalledWith(1, 10);
      expect(store.getState().currentPage).toBe(1);
    });

    it("toggles isLoading while the request is in flight", async () => {
      let resolveFetch: (value: { items: Item[]; totalItems: number }) => void;
      fetcher.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );
      const store = makeStore(10);

      const promise = store.getState().fetchPage(1);
      expect(store.getState().isLoading).toBe(true);
      resolveFetch!({ items: [], totalItems: 0 });
      await promise;

      expect(store.getState().isLoading).toBe(false);
    });

    it("guarantees at least one page when total items is zero", async () => {
      fetcher.mockResolvedValue({ items: [], totalItems: 0 });
      const store = makeStore(10);
      await store.getState().fetchPage(1);
      expect(store.getState().totalPages).toBe(1);
    });
  });

  describe("fetchPage (error path)", () => {
    it("stores a network error message and clears data", async () => {
      fetcher.mockRejectedValue(new Error("Network down"));
      const store = makeStore(10);

      // First load succeeds, then a failing request clears it.
      fetcher.mockResolvedValueOnce({ items: [{ id: 1 }], totalItems: 10 });
      await store.getState().fetchPage(1);
      expect(store.getState().data).toEqual([{ id: 1 }]);

      await store.getState().fetchPage(2);
      const state = store.getState();
      expect(state.error).toBe("Network down");
      expect(state.data).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it("falls back to a generic message for non-Error rejections", async () => {
      fetcher.mockRejectedValue("boom");
      const store = makeStore(10);
      await store.getState().fetchPage(1);
      expect(store.getState().error).toBe("Failed to load page");
    });
  });

  describe("deduplication", () => {
    it("does not refetch the already-loaded current page", async () => {
      fetcher.mockResolvedValue({ items: [{ id: 1 }], totalItems: 10 });
      const store = makeStore(10);
      await store.getState().fetchPage(1);
      expect(fetcher).toHaveBeenCalledTimes(1);

      await store.getState().fetchPage(1);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("refetches the current page after an error", async () => {
      fetcher
        .mockRejectedValueOnce(new Error("down"))
        .mockResolvedValueOnce({ items: [{ id: 1 }], totalItems: 10 });
      const store = makeStore(10);

      await store.getState().fetchPage(1);
      expect(store.getState().error).toBe("down");

      await store.getState().fetchPage(1);
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(store.getState().data).toEqual([{ id: 1 }]);
    });
  });

  describe("retry", () => {
    it("retries the current page after a failure", async () => {
      fetcher
        .mockRejectedValueOnce(new Error("down"))
        .mockResolvedValueOnce({ items: [{ id: 9 }], totalItems: 30 });
      const store = makeStore(10);
      expect(store.getState().currentPage).toBe(1);

      await store.getState().fetchPage(1);
      expect(store.getState().error).toBe("down");

      await store.getState().retry();
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(store.getState().error).toBeNull();
      expect(store.getState().data).toEqual([{ id: 9 }]);
    });
  });

  describe("setPageSize", () => {
    it("resets pagination state and backs data to page 1", async () => {
      fetcher.mockResolvedValue({ items: [{ id: 1 }], totalItems: 100 });
      const store = makeStore(10);
      await store.getState().fetchPage(3);
      expect(store.getState().currentPage).toBe(3);

      store.getState().setPageSize(20);
      const state = store.getState();
      expect(state.pageSize).toBe(20);
      expect(state.currentPage).toBe(1);
      expect(state.totalPages).toBe(0);
      expect(state.data).toBeNull();
    });

    it("coerces a zero or negative page size to at least 1", () => {
      fetcher.mockResolvedValue({ items: [], totalItems: 0 });
      const store = makeStore(10);
      store.getState().setPageSize(-5);
      expect(store.getState().pageSize).toBe(1);
    });
  });

  describe("reset", () => {
    it("clears all pagination state", async () => {
      fetcher.mockResolvedValue({ items: [{ id: 1 }], totalItems: 30 });
      const store = makeStore(10);
      await store.getState().fetchPage(2);

      store.getState().reset();
      const state = store.getState();
      expect(state.currentPage).toBe(1);
      expect(state.totalPages).toBe(0);
      expect(state.data).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe("module-level hook integration", () => {
    it("exposes a fetchPage that resolves the promised data", async () => {
      fetcher.mockResolvedValue({ items: [{ id: 7 }], totalItems: 15 });
      const store = makeStore(5);
      await store.getState().fetchPage(3);
      expect(store.getState().totalPages).toBe(3);
      expect(store.getState().data).toEqual([{ id: 7 }]);
    });
  });

  describe("default fetcher typing", () => {
    it("provides a page fetcher type usable as a mock", () => {
      const typedFetcher: PageFetcher<Item> = jest.fn();
      expect(typeof typedFetcher).toBe("function");
    });
  });
});
