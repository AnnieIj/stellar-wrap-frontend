/**
 * @jest-environment jsdom
 *
 * Tests for useRecentLedgers (issue #428): caching via React Query, and the
 * optimistic-refresh / rollback-on-failure contract of `refresh()`.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { RecentLedger } from "../../services/horizonIndexer";

jest.mock("../../services/horizonIndexer", () => ({
  horizonIndexer: {
    getLedgers: jest.fn(),
  },
}));

// Import after the mock is set up.
import { useRecentLedgers } from "../useRecentLedgers";
import { horizonIndexer } from "../../services/horizonIndexer";

const mockGetLedgers = horizonIndexer.getLedgers as jest.MockedFunction<
  typeof horizonIndexer.getLedgers
>;

const LEDGER_A: RecentLedger = {
  id: "1",
  sequence: 100,
  hash: "hash-a",
  closedAt: "2026-01-01T00:00:00Z",
  successfulTransactionCount: 5,
  failedTransactionCount: 0,
  operationCount: 10,
};

const LEDGER_B: RecentLedger = {
  id: "2",
  sequence: 101,
  hash: "hash-b",
  closedAt: "2026-01-01T00:00:05Z",
  successfulTransactionCount: 3,
  failedTransactionCount: 0,
  operationCount: 4,
};

/**
 * A promise whose resolution is controlled from outside, so a test can
 * deterministically observe a hook's pending state before letting the
 * underlying async call complete — a plain `mockResolvedValueOnce` can
 * resolve within the same microtask flush as `act()`, making the pending
 * window unobservable.
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useRecentLedgers", () => {
  beforeEach(() => {
    mockGetLedgers.mockReset();
  });

  it("fetches once and exposes the cached ledgers (local caching / no redundant fetching)", async () => {
    mockGetLedgers.mockResolvedValue([LEDGER_A]);

    const { result } = renderHook(() => useRecentLedgers("mainnet", 20), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.ledgers).toEqual([LEDGER_A]);
    expect(mockGetLedgers).toHaveBeenCalledTimes(1);
    expect(mockGetLedgers).toHaveBeenCalledWith("mainnet", 20);
  });

  it("refresh() flips to a pending state immediately and replaces cached data on success", async () => {
    mockGetLedgers.mockResolvedValueOnce([LEDGER_A]);

    const { result } = renderHook(() => useRecentLedgers("mainnet", 20), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.ledgers).toEqual([LEDGER_A]));

    const refreshCall = deferred<RecentLedger[]>();
    mockGetLedgers.mockReturnValueOnce(refreshCall.promise);

    act(() => {
      result.current.refresh();
    });

    // Optimistic: pending state is visible before the network call resolves
    // (the mock promise above only resolves once we call `.resolve()` below).
    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    expect(result.current.ledgers).toEqual([LEDGER_A]);

    await act(async () => {
      refreshCall.resolve([LEDGER_B, LEDGER_A]);
    });

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.ledgers).toEqual([LEDGER_B, LEDGER_A]);
  });

  it("rolls back to the last known-good data if refresh fails, without corrupting the list", async () => {
    mockGetLedgers.mockResolvedValueOnce([LEDGER_A]);

    const { result } = renderHook(() => useRecentLedgers("mainnet", 20), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.ledgers).toEqual([LEDGER_A]));

    const refreshCall = deferred<RecentLedger[]>();
    mockGetLedgers.mockReturnValueOnce(refreshCall.promise);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    // Still showing the pre-refresh data while the refresh is in flight.
    expect(result.current.ledgers).toEqual([LEDGER_A]);

    await act(async () => {
      refreshCall.reject({
        type: "UNKNOWN",
        status: 500,
        message: "boom",
        isRetryable: false,
        originalError: null,
      });
    });

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));

    // Rolled back: still the pre-refresh data, and the base query itself
    // never entered an error state — only the refresh action failed.
    expect(result.current.ledgers).toEqual([LEDGER_A]);
    expect(result.current.isError).toBe(false);
    expect(result.current.refreshError?.message).toBe("boom");
  });
});
