/**
 * Cache state machine for the browser indexer (issue #623).
 *
 * `indexAccount` in `app/services/indexerService.ts` is where the documented
 * 60-minute cache contract is actually implemented. The existing unit tests
 * only covered "a valid entry" and "an invalid entry", both well inside or well
 * outside the window. These tests pin the boundary itself and the background
 * refresh path.
 */

jest.mock("../indexerCore", () => ({
  runIndexingCore: jest.fn(),
}));

jest.mock("@/app/utils/indexedDbCache", () => ({
  getCacheEntry: jest.fn(),
  setCacheEntry: jest.fn(),
}));

jest.mock("@/app/utils/indexerDebug", () => ({
  indexerWarn: jest.fn(),
}));

import { indexAccount } from "../indexerService";
import { runIndexingCore } from "../indexerCore";
import { getCacheEntry, setCacheEntry } from "@/app/utils/indexedDbCache";
import { CACHE_TTL_MINUTES, getCacheKey } from "@/app/utils/indexer";
import type { IndexerResult } from "@/app/utils/indexer";

const mockCore = runIndexingCore as jest.MockedFunction<typeof runIndexingCore>;
const mockGet = getCacheEntry as jest.MockedFunction<typeof getCacheEntry>;
const mockSet = setCacheEntry as jest.MockedFunction<typeof setCacheEntry>;

const ACCOUNT = "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ";
const TTL_MS = CACHE_TTL_MINUTES * 60 * 1000;
const KEY = getCacheKey(ACCOUNT, "mainnet", "monthly");

function result(totalTransactions: number): IndexerResult {
  return {
    accountId: ACCOUNT,
    totalTransactions,
    totalVolume: 0,
    mostActiveAsset: "XLM",
    contractCalls: 0,
    gasSpent: 0,
    dapps: [],
    vibes: [],
  } as IndexerResult;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSet.mockResolvedValue(undefined);
});

describe("cold fetch", () => {
  it("indexes and stores the result, reporting an uncached payload", async () => {
    mockGet.mockResolvedValue(null);
    mockCore.mockResolvedValue(result(10));

    const out = await indexAccount(ACCOUNT, "mainnet", "monthly");

    expect(out.fromCache).toBe(false);
    expect(out.result.totalTransactions).toBe(10);
    expect(out.refreshingInBackground).toBeUndefined();
    expect(mockCore).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(KEY, {
      result: expect.objectContaining({ totalTransactions: 10 }),
      timestamp: expect.any(Number),
    });
  });
});

describe("warm fetch inside the 60-minute window", () => {
  it("returns cached data with its timestamp and does not re-index", async () => {
    const now = Date.now();
    const timestamp = now - 30 * 60 * 1000;
    mockGet.mockResolvedValue({ result: result(42), timestamp });

    const out = await indexAccount(ACCOUNT, "mainnet", "monthly");

    expect(out.fromCache).toBe(true);
    expect(out.cacheTimestamp).toBe(timestamp);
    expect(out.result.totalTransactions).toBe(42);
    expect(out.refreshingInBackground).toBeUndefined();
    expect(mockCore).not.toHaveBeenCalled();
  });
});

describe("TTL boundary", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is still fresh one millisecond inside the window", async () => {
    const now = Date.parse("2026-09-25T12:00:00.000Z");
    jest.setSystemTime(now);
    mockGet.mockResolvedValue({
      result: result(7),
      timestamp: now - (TTL_MS - 1),
    });

    const out = await indexAccount(ACCOUNT, "mainnet", "monthly");

    expect(out.fromCache).toBe(true);
    expect(out.refreshingInBackground).toBeUndefined();
    expect(mockCore).not.toHaveBeenCalled();
  });

  it("treats an entry exactly 60 minutes old as stale and refreshes it", async () => {
    const now = Date.parse("2026-09-25T12:00:00.000Z");
    jest.setSystemTime(now);
    mockGet.mockResolvedValue({ result: result(7), timestamp: now - TTL_MS });
    mockCore.mockResolvedValue(result(8));

    const out = await indexAccount(ACCOUNT, "mainnet", "monthly");

    // The documented contract is `age < ttl`, so the boundary itself is stale.
    expect(out.fromCache).toBe(true);
    expect(out.refreshingInBackground).toBe(true);
    expect(out.result.totalTransactions).toBe(7);
    expect(mockCore).toHaveBeenCalledTimes(1);
  });

  it("treats an entry one millisecond past the boundary as stale too", async () => {
    const now = Date.parse("2026-09-25T12:00:00.000Z");
    jest.setSystemTime(now);
    mockGet.mockResolvedValue({
      result: result(7),
      timestamp: now - (TTL_MS + 1),
    });
    mockCore.mockResolvedValue(result(9));

    const out = await indexAccount(ACCOUNT, "mainnet", "monthly");

    expect(out.refreshingInBackground).toBe(true);
    expect(mockCore).toHaveBeenCalledTimes(1);
  });
});

describe("background refresh", () => {
  it("writes the re-indexed result back to the cache when it settles", async () => {
    let resolveRefresh: (value: IndexerResult) => void = () => {};
    mockGet.mockResolvedValue({
      result: result(1),
      timestamp: Date.now() - TTL_MS - 1,
    });
    mockCore.mockReturnValue(
      new Promise<IndexerResult>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const out = await indexAccount(ACCOUNT, "mainnet", "monthly");

    // The caller is not made to wait.
    expect(out.result.totalTransactions).toBe(1);
    expect(out.refreshingInBackground).toBe(true);
    expect(mockSet).not.toHaveBeenCalled();

    resolveRefresh(result(2));
    await Promise.resolve();
    await Promise.resolve();

    expect(mockSet).toHaveBeenCalledWith(KEY, {
      result: expect.objectContaining({ totalTransactions: 2 }),
      timestamp: expect.any(Number),
    });
  });

  it("serves the stale payload to a concurrent request for the same account", async () => {
    mockGet.mockResolvedValue({
      result: result(1),
      timestamp: Date.now() - TTL_MS - 1,
    });
    mockCore.mockImplementation(() => new Promise<IndexerResult>(() => {}));

    const [a, b] = await Promise.all([
      indexAccount(ACCOUNT, "mainnet", "monthly"),
      indexAccount(ACCOUNT, "mainnet", "monthly"),
    ]);

    for (const out of [a, b]) {
      expect(out.fromCache).toBe(true);
      expect(out.refreshingInBackground).toBe(true);
      expect(out.result.totalTransactions).toBe(1);
    }
  });
});

describe("bypassCache", () => {
  it("ignores a fresh cache entry when the caller opts out", async () => {
    mockGet.mockResolvedValue({ result: result(1), timestamp: Date.now() });
    mockCore.mockResolvedValue(result(3));

    const out = await indexAccount(ACCOUNT, "mainnet", "monthly", {
      bypassCache: true,
    });

    expect(out.fromCache).toBe(false);
    expect(out.result.totalTransactions).toBe(3);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
