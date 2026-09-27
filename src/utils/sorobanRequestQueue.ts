/**
 * Soroban RPC request queue.
 *
 * Serializes and coalesces Soroban RPC calls so bursts of identical requests
 * (e.g. `getAccount` / `simulateTransaction` during transaction build + wallet
 * re-validation) share a single network round-trip and never trigger provider
 * rate limiting. Transient failures (timeouts, 429/408/503/504, connection
 * resets) are retried with exponential backoff.
 *
 * Read-only by design: callers performing state-changing RPCs (sendTransaction)
 * can opt out of auto-retry with `retry: false` and still benefit from the
 * concurrency cap.
 *
 * @module sorobanRequestQueue
 */

export interface EnqueueOptions {
  /** Whether transient failures should be retried with backoff. Default true. */
  retry?: boolean;
}

interface PendingTask<T> {
  factory: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  attempts: number;
  retry: boolean;
}

/**
 * Detects errors worth retrying: rate limits, transient HTTP statuses, and
 * network-level failures. Contract/logic errors are never retried.
 */
export function isRetryableRpcError(error: unknown): boolean {
  const status =
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? String((error as { status: number }).status)
      : "";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : status;
  const lowered = message.toLowerCase();

  if (
    lowered.includes("429") ||
    lowered.includes("408") ||
    lowered.includes("503") ||
    lowered.includes("504") ||
    lowered.includes("520") ||
    lowered.includes("521") ||
    lowered.includes("522") ||
    lowered.includes("524") ||
    lowered.includes("rate limit") ||
    lowered.includes("timeout") ||
    lowered.includes("timed out") ||
    lowered.includes("econnreset") ||
    lowered.includes("econnrefused") ||
    lowered.includes("fetch failed") ||
    lowered.includes("networkerror") ||
    lowered.includes("network error") ||
    lowered.includes("server busy")
  ) {
    return true;
  }

  return false;
}

const RETRYABLE_BACKOFF_MS = 500;

export class SorobanRequestQueue {
  private queue: PendingTask<unknown>[] = [];
  private processing = false;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly maxConcurrency: number = 2,
    private readonly maxAttempts: number = 3,
    private readonly initialBackoffMs: number = RETRYABLE_BACKOFF_MS,
  ) {}

  /**
   * Runs `factory`, respecting the concurrency cap and retrying transient
   * failures (when enabled) with exponential backoff.
   */
  enqueue<T>(factory: () => Promise<T>, options: EnqueueOptions = {}): Promise<T> {
    const retry = options.retry ?? true;

    return new Promise<T>((resolve, reject) => {
      const task: PendingTask<T> = {
        factory,
        resolve,
        reject,
        attempts: 0,
        retry,
      };
      (this.queue as PendingTask<unknown>[]).push(task);
      void this.processQueue();
    });
  }

  /**
   * Deduplicates concurrent identical calls. While a request for `key` is in
   * flight, subsequent calls for the same key receive the same promise.
   */
  coalesce<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.inFlight.get(key);
    if (cached !== undefined) {
      return cached as Promise<T>;
    }

    const promise = this.enqueue(factory);
    this.inFlight.set(key, promise);

    promise
      .then(() => this.inFlight.delete(key))
      .catch(() => this.inFlight.delete(key));

    return promise;
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    const batchSize = Math.min(this.queue.length, this.maxConcurrency);
    const batch = this.queue.splice(0, batchSize);

    await Promise.all(batch.map((item) => this.executeRequest(item)));

    this.processing = false;

    if (this.queue.length > 0) {
      void this.processQueue();
    }
  }

  private async executeRequest(item: PendingTask<unknown>): Promise<void> {
    try {
      const result = await item.factory();
      item.resolve(result);
    } catch (error) {
      if (item.retry && isRetryableRpcError(error) && item.attempts < this.maxAttempts) {
        item.attempts += 1;
        const delay = this.backoffForAttempt(item.attempts);
        setTimeout(() => {
          this.queue.push(item);
          void this.processQueue();
        }, delay);
        return;
      }
      item.reject(error);
    }
  }

  private backoffForAttempt(attempt: number): number {
    return Math.min(this.initialBackoffMs * 2 ** (attempt - 1), 16_000);
  }

  clear(): void {
    this.queue.forEach((item) => item.reject(new Error("Soroban request queue cleared")));
    this.queue = [];
    this.inFlight.clear();
  }
}

/** Shared singleton for the whole app. */
export const sorobanQueue = new SorobanRequestQueue(2, 3, RETRYABLE_BACKOFF_MS);