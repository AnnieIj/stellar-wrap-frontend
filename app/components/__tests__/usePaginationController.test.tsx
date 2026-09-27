/**
 * @jest-environment jsdom
 *
 * Tests for the usePaginationController hook, which bridges a pagination
 * store (global state backed by a mockable page fetcher) with the Pagination
 * component.
 */

import { renderHook, act } from "@testing-library/react";
import { usePaginationController } from "../usePaginationController";
import { createPaginationStore } from "../paginationStore";
import type { PageFetcher } from "../paginationStore";

type Item = { id: number };

describe("usePaginationController", () => {
  let fetcher: jest.Mock<Promise<{ items: Item[]; totalItems: number }>>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetcher = jest.fn();
  });

  it("returns the default initial state", () => {
    fetcher.mockResolvedValue({ items: [], totalItems: 0 });
    const { result } = renderHook(() => usePaginationController<Item>());
    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(0);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("exposes a goToPage that loads the requested page", async () => {
    fetcher.mockResolvedValue({ items: [{ id: 5 }], totalItems: 40 });
    const { result } = renderHook(() =>
      usePaginationController<Item>({ fetcher, pageSize: 10 }),
    );

    await act(async () => {
      result.current.goToPage(2);
    });

    expect(fetcher).toHaveBeenCalledWith(2, 10);
    expect(result.current.currentPage).toBe(2);
    expect(result.current.data).toEqual([{ id: 5 }]);
    expect(result.current.totalPages).toBe(4);
  });

  it("propagates an error from the fetcher", async () => {
    fetcher.mockRejectedValue(new Error("timeout"));
    const { result } = renderHook(() =>
      usePaginationController<Item>({ fetcher, pageSize: 10 }),
    );

    await act(async () => {
      result.current.goToPage(1);
    });

    expect(result.current.error).toBe("timeout");
    expect(result.current.data).toBeNull();
  });

  it("uses an externally supplied store", async () => {
    fetcher.mockResolvedValue({ items: [{ id: 1 }], totalItems: 25 });
    const store = createPaginationStore<Item>(fetcher, 5);

    const { result } = renderHook(() =>
      usePaginationController<Item>({ store }),
    );

    await act(async () => {
      result.current.goToPage(3);
    });

    expect(result.current.pageSize).toBe(5);
    expect(result.current.totalPages).toBe(5);
    expect(fetcher).toHaveBeenCalledWith(3, 5);
  });

  it("supports changing the page size", async () => {
    const { result } = renderHook(() =>
      usePaginationController<Item>({ fetcher, pageSize: 10 }),
    );

    await act(async () => {
      result.current.setPageSize(25);
    });

    expect(result.current.pageSize).toBe(25);
    expect(result.current.currentPage).toBe(1);
  });

  it("supports resetting state", async () => {
    fetcher.mockResolvedValue({ items: [{ id: 1 }], totalItems: 30 });
    const { result } = renderHook(() =>
      usePaginationController<Item>({ fetcher, pageSize: 10 }),
    );

    await act(async () => {
      result.current.goToPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    await act(async () => {
      result.current.reset();
    });
    expect(result.current.currentPage).toBe(1);
    expect(result.current.data).toBeNull();
  });

  it("exports a fetcher type usable in javascript mocks", () => {
    const typedFetcher: PageFetcher<Item> = jest.fn();
    expect(typeof typedFetcher).toBe("function");
  });
});
