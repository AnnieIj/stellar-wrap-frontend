import { useState, useEffect, useCallback, useRef } from "react";
import { useRateLimitStore } from "../store/rateLimitStore";

const DEFAULT_RPC_TIMEOUT_MS = 30_000;
const DEFAULT_MIN_INTERVAL_MS = 250;

interface RpcCallOptions {
  /** Maximum time to wait for the RPC call to complete. */
  timeoutMs?: number;
  /** Minimum time to wait between RPC calls to avoid rate limiting. */
  minIntervalMs?: number;
}

/**
 * Error type for RPC-related failures.
 */
export class RpcError extends Error {
  readonly code: number | undefined;
  readonly userRejected: boolean;

  constructor(message: string, code?: number, userRejected = false) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.userRejected = userRejected;
  }
}

function isUserRejection(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown; name?: unknown };
  if (candidate.code === 4001) {
    return true;
  }

  const message = typeof candidate.message === "string" ? candidate.message : "";
  return /user rejected|request rejected|declined/i.test(message);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hook to monitor rate limit status and provide countdown until reset.
 * Also exposes a helper to safely execute RPC calls with timeout and throttling.
 */
export function useRateLimit() {
  const { isRateLimited, resetTime, retryAttempt, message } = useRateLimitStore();
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const lastCallTimeRef = useRef<number>(0);

  useEffect(() => {
    // Guard: clear countdown when not rate limited
    if (!isRateLimited || !resetTime) {
      // Use a microtask to avoid synchronous setState inside the effect body
      const timer = setTimeout(() => setSecondsRemaining(null), 0);
      return () => clearTimeout(timer);
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((resetTime - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [isRateLimited, resetTime]);

  // Allows callers to wait until the rate limit resets before making RPC calls.
  const waitForReset = useCallback(async () => {
    if (!isRateLimited) return;
    const resetAt = resetTime ?? Date.now();
    const delay = Math.max(0, resetAt - Date.now());
    await wait(delay);
  }, [isRateLimited, resetTime]);

  // Ensures a minimum delay between RPC calls to prevent hitting rate limits.
  const throttleIfNeeded = useCallback(async (minIntervalMs: number) => {
    const elapsed = Date.now() - lastCallTimeRef.current;
    if (elapsed < minIntervalMs) {
      await wait(minIntervalMs - elapsed);
    }
  }, []);

  /**
   * Executes an RPC call with a timeout and throttling.
   * If the user rejects the request (e.g., in Freighter), a clear RpcError is thrown.
   * Use this for Soroban RPC calls such as simulateTransaction and sendTransaction.
   */
  const callWithRateLimit = useCallback(
    async <T>(
      rpcCall: (signal?: AbortSignal) => Promise<T>,
      options: RpcCallOptions = {}
    ): Promise<T> => {
      const { timeoutMs = DEFAULT_RPC_TIMEOUT_MS, minIntervalMs = DEFAULT_MIN_INTERVAL_MS } =
        options;

      // Respect any active rate limit before making the call.
      await waitForReset();
      await throttleIfNeeded(minIntervalMs);

      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

      try {
        const result = await rpcCall(timeoutController.signal);
        lastCallTimeRef.current = Date.now();
        return result;
      } catch (error) {
        if (timeoutController.signal.aborted) {
          throw new RpcError(`RPC call timed out after ${timeoutMs}ms`);
        }
        if (isUserRejection(error)) {
          throw new RpcError("User rejected the transaction signature.", 4001, true);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [waitForReset, throttleIfNeeded]
  );

  return {
    isRateLimited,
    secondsRemaining,
    retryAttempt,
    message,
    waitForReset,
    callWithRateLimit,
  };
}
