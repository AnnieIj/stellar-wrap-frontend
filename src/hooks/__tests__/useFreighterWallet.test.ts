/**
 * Unit tests for useFreighterWallet
 *
 * Covers every acceptance criterion:
 *   1. Connects successfully and exposes the public key + shortKey
 *   2. Handles user rejection (USER_REJECTED error code)
 *   3. Handles Freighter not installed (NOT_INSTALLED error code)
 *   4. Handles network mismatch (NETWORK_MISMATCH error code + mismatch object)
 *   5. Handles connection timeout (TIMEOUT error code via AbortController)
 *   6. Retries after an error — resets state and reconnects
 *   7. Disconnect — clears publicKey, balance, and resets to idle
 *   8. Skips balance fetch when rate-limited
 *   9. formattedBalance is set after a successful balance fetch
 *  10. Balance fetch routes through horizonQueue (not raw loadAccount directly)
 *  11. Disconnect does NOT produce a TIMEOUT error (timedOut flag)
 *
 * Run with:
 *   pnpm test:hooks
 */

/// <reference types="vitest/globals" />

import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ─── Hoist: create stubs before vi.mock hoisting ──────────────────────────────

const mocks = vi.hoisted(() => {
  const connectFreighter = vi.fn<[string], Promise<string>>();

  class FreighterNotInstalledError extends Error {
    readonly installUrl = "https://www.freighter.app/";
    constructor() {
      super("Freighter is not installed.");
      this.name = "FreighterNotInstalledError";
    }
  }

  class NetworkMismatchError extends Error {
    readonly expected: string;
    readonly actual: string;
    constructor(expected: string, actual: string) {
      super(`Mismatch: expected ${expected}, got ${actual}`);
      this.name = "NetworkMismatchError";
      this.expected = expected;
      this.actual = actual;
    }
  }

  const loadAccount = vi.fn();
  const getHorizonServer = vi.fn(() => ({ loadAccount }));
  const enqueue = vi.fn(<T>(fn: () => Promise<T>): Promise<T> => fn());
  const useRateLimitStore = vi.fn(() => ({ isRateLimited: false }));

  return {
    connectFreighter,
    FreighterNotInstalledError,
    NetworkMismatchError,
    loadAccount,
    getHorizonServer,
    enqueue,
    useRateLimitStore,
  };
});

// ─── Register mocks ───────────────────────────────────────────────────────────

vi.mock("../../../app/utils/walletConnect", () => ({
  connectFreighter: (n: string) => mocks.connectFreighter(n),
  FreighterNotInstalledError: mocks.FreighterNotInstalledError,
  NetworkMismatchError: mocks.NetworkMismatchError,
}));

vi.mock("../../../app/utils/stellarClient", () => ({
  getHorizonServer: (n: string) => mocks.getHorizonServer(n),
}));

vi.mock("../../utils/horizonRequestQueue", () => ({
  horizonQueue: {
    enqueue: <T>(fn: () => Promise<T>): Promise<T> => mocks.enqueue(fn),
  },
}));

vi.mock("../../store/rateLimitStore", () => ({
  useRateLimitStore: () => mocks.useRateLimitStore(),
}));

// Import the hook after mocks.
import { useFreighterWallet } from "../useFreighterWallet";

// ─── Constants ────────────────────────────────────────────────────────────────

const PUBLIC_KEY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderHookDefault() {
  return renderHook(() => useFreighterWallet("mainnet"));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useFreighterWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadAccount.mockResolvedValue({
      balances: [{ asset_type: "native", balance: "100.0000000" }],
    });
    mocks.enqueue.mockImplementation(<T>(fn: () => Promise<T>): Promise<T> =>
      fn(),
    );
    mocks.useRateLimitStore.mockReturnValue({ isRateLimited: false });
  });

  // ── 1. Initial state ────────────────────────────────────────────────────────

  describe("initial state", () => {
    it("starts as idle with no public key or error", () => {
      const { result } = renderHookDefault();
      expect(result.current.connectionState).toBe("idle");
      expect(result.current.publicKey).toBeNull();
      expect(result.current.shortKey).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.formattedBalance).toBeNull();
    });
  });

  // ── 2. Successful connection ────────────────────────────────────────────────

  describe("successful connection", () => {
    it("reaches connected state after connect()", async () => {
      mocks.connectFreighter.mockResolvedValue(PUBLIC_KEY);
      const { result } = renderHookDefault();
      expect(result.current.connectionState).toBe("idle");

      await act(() => result.current.connect());

      expect(result.current.connectionState).toBe("connected");
    });

    it("exposes the full public key", async () => {
      mocks.connectFreighter.mockResolvedValue(PUBLIC_KEY);
      const { result } = renderHookDefault();

      await act(() => result.current.connect());

      expect(result.current.publicKey).toBe(PUBLIC_KEY);
    });

    it("exposes a truncated shortKey (prefix 6 + suffix 4)", async () => {
      mocks.connectFreighter.mockResolvedValue(PUBLIC_KEY);
      const { result } = renderHookDefault();

      await act(() => result.current.connect());

      expect(result.current.shortKey).toBe("GAAZI4\u2026CCWN");
    });

    it("clears any previous error on successful reconnect", async () => {
      mocks.connectFreighter.mockRejectedValueOnce(new Error("rejected by user"));
      const { result } = renderHookDefault();
      await act(() => result.current.connect());
      expect(result.current.error).not.toBeNull();

      mocks.connectFreighter.mockResolvedValue(PUBLIC_KEY);
      act(() => result.current.retry());

      await waitFor(() =>
        expect(result.current.connectionState).toBe("connected"),
      );
      expect(result.current.error).toBeNull();
    });

    it("does not start a second connection if already connected", async () => {
      mocks.connectFreighter.mockResolvedValue(PUBLIC_KEY);
      const { result } = renderHookDefault();

      await act(() => result.current.connect());
      expect(result.current.connectionState).toBe("connected");

      await act(() => result.current.connect());

      expect(mocks.connectFreighter).toHaveBeenCalledTimes(1);
    });
  });

  // ── 3. Balance fetch ────────────────────────────────────────────────────────

  describe("balance fetch", () => {
    it("routes through horizonQueue (not raw loadAccount)", async () => {
      mocks.connectFreighter.mockResolvedValue(PUBLIC_KEY);
      const { result } = renderHookDefault();

      await act(() => result.current.connect());

      await waitFor(() =>
        expect(result.current.formattedBalance).not.toBeNull(),
      );

      expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    });

    it("sets formattedBalance after a successful Horizon call", async () => {
      mocks.connectFreighter.mockResolvedValue(PUBLIC_KEY);
      mocks.loadAccount.mockResolvedValue({
        balances: [{ asset_type: "native", balance: "250.5000000" }],
      });

      const { result } = renderHookDefault();
      await act(() => result.current.connect());

      await waitFor(() =>
        expect(result.current.formattedBalance).not.toBeNull(),
      );

      expect(result.current.formattedBalance).toBe("250.50 XLM");
    });

    it("leaves formattedBalance null if Horizon call fails", async () => {
      mocks.connectFreighter.mockResolvedValue(PUBLIC_KEY);
      mocks.loadAccount.mockRejectedValue(new Error("network error"));

      const { result } = renderHookDefault();
      await act(() => result.current.connect());

      await waitFor(() => expect(result.current.isLoadingBalance).toBe(false));

      expect(result.current.formattedBalance).toBeNull();
      expect(result.current.connectionState).toBe("connected");
    });

    it("skips Horizon call when rate-limited", async () => {
      mocks.useRateLimitStore.mockReturnValue({ isRateLimited: true });
      mocks.connectFreighter.mockResolvedValue(PUBLIC_KEY);

      const { result } = renderHookDefault();
      await act(() => result.current.connect());
      await act(() => Promise.resolve());

      expect(mocks.enqueue).not.toHaveBeenCalled();
      expect(mocks.loadAccount).not.toHaveBeenCalled();
      expect(result.current.formattedBalance).toBeNull();
    });
  });

  // ── 4. User rejected ────────────────────────────────────────────────────────

  describe("USER_REJECTED error", () => {
    const rejectionMessages = [
      "User declined access",
      "rejected by user",
      "connection rejected",
      "Rejected",
    ];

    it.each(rejectionMessages)(
      "sets USER_REJECTED for message: %s",
      async (msg) => {
        mocks.connectFreighter.mockRejectedValue(new Error(msg));
        const { result } = renderHookDefault();

        await act(() => result.current.connect());

        expect(result.current.connectionState).toBe("error");
        expect(result.current.error?.code).toBe("USER_REJECTED");
        expect(result.current.publicKey).toBeNull();
      },
    );
  });

  // ── 5. Not installed ────────────────────────────────────────────────────────

  describe("NOT_INSTALLED error", () => {
    it("sets NOT_INSTALLED and exposes installUrl", async () => {
      mocks.connectFreighter.mockRejectedValue(
        new mocks.FreighterNotInstalledError(),
      );
      const { result } = renderHookDefault();

      await act(() => result.current.connect());

      expect(result.current.connectionState).toBe("error");
      expect(result.current.error?.code).toBe("NOT_INSTALLED");
      expect(result.current.error?.installUrl).toBe("https://www.freighter.app/");
    });
  });

  // ── 6. Network mismatch ─────────────────────────────────────────────────────

  describe("NETWORK_MISMATCH error", () => {
    it("sets NETWORK_MISMATCH and exposes both sides", async () => {
      mocks.connectFreighter.mockRejectedValue(
        new mocks.NetworkMismatchError("mainnet", "testnet"),
      );
      const { result } = renderHookDefault();

      await act(() => result.current.connect());

      expect(result.current.connectionState).toBe("error");
      expect(result.current.error?.code).toBe("NETWORK_MISMATCH");
      expect(result.current.error?.mismatch).toEqual({
        expected: "mainnet",
        actual: "testnet",
      });
    });
  });

  // ── 7. Timeout ──────────────────────────────────────────────────────────────

  describe("TIMEOUT error", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("sets TIMEOUT when Freighter does not respond within 30 s", async () => {
      mocks.connectFreighter.mockReturnValue(new Promise(() => {}));

      const { result } = renderHookDefault();

      await act(async () => {
        result.current.connect();
        vi.advanceTimersByTime(30_001);
        await Promise.resolve();
        await Promise.resolve(); // flush microtask queue
      });

      expect(result.current.connectionState).toBe("error");
      expect(result.current.error?.code).toBe("TIMEOUT");
    });

    it("does NOT produce TIMEOUT when abort is caused by disconnect()", async () => {
      mocks.connectFreighter.mockReturnValue(new Promise(() => {}));

      const { result } = renderHookDefault();

      await act(async () => {
        result.current.connect();
        await Promise.resolve();
      });

      await act(async () => {
        result.current.disconnect();
        await Promise.resolve();
      });

      expect(result.current.connectionState).toBe("idle");
      expect(result.current.error).toBeNull();
    });
  });

  // ── 8. Unknown error ────────────────────────────────────────────────────────

  describe("UNKNOWN error", () => {
    it("wraps unexpected Error objects", async () => {
      mocks.connectFreighter.mockRejectedValue(
        new Error("Some unexpected internal error"),
      );
      const { result } = renderHookDefault();

      await act(() => result.current.connect());

      expect(result.current.error?.code).toBe("UNKNOWN");
      expect(result.current.error?.message).toContain(
        "Some unexpected internal error",
      );
    });

    it("handles non-Error throws", async () => {
      mocks.connectFreighter.mockRejectedValue("string error");
      const { result } = renderHookDefault();

      await act(() => result.current.connect());

      expect(result.current.error?.code).toBe("UNKNOWN");
    });
  });

  // ── 9. retry() ──────────────────────────────────────────────────────────────

  describe("retry()", () => {
    it("is a no-op when connectionState is not error", () => {
      const { result } = renderHookDefault();
      expect(result.current.connectionState).toBe("idle");

      act(() => result.current.retry());

      expect(mocks.connectFreighter).not.toHaveBeenCalled();
    });

    it("clears error and reconnects after a failed attempt", async () => {
      mocks.connectFreighter
        .mockRejectedValueOnce(new Error("rejected by user"))
        .mockResolvedValueOnce(PUBLIC_KEY);

      const { result } = renderHookDefault();

      await act(() => result.current.connect());
      expect(result.current.error?.code).toBe("USER_REJECTED");

      act(() => result.current.retry());

      await waitFor(() =>
        expect(result.current.connectionState).toBe("connected"),
      );
      expect(result.current.error).toBeNull();
      expect(result.current.publicKey).toBe(PUBLIC_KEY);
    });
  });

  // ── 10. disconnect() ─────────────────────────────────────────────────────────

  describe("disconnect()", () => {
    it("resets all state to idle", async () => {
      mocks.connectFreighter.mockResolvedValue(PUBLIC_KEY);
      const { result } = renderHookDefault();

      await act(() => result.current.connect());
      expect(result.current.connectionState).toBe("connected");

      act(() => result.current.disconnect());

      expect(result.current.connectionState).toBe("idle");
      expect(result.current.publicKey).toBeNull();
      expect(result.current.shortKey).toBeNull();
      expect(result.current.formattedBalance).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("clears error state too", async () => {
      mocks.connectFreighter.mockRejectedValue(
        new mocks.FreighterNotInstalledError(),
      );
      const { result } = renderHookDefault();

      await act(() => result.current.connect());
      expect(result.current.error).not.toBeNull();

      act(() => result.current.disconnect());

      expect(result.current.error).toBeNull();
      expect(result.current.connectionState).toBe("idle");
    });
  });
});
