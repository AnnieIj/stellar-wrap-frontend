/**
 * Browser indexer service — wraps server-safe core with IndexedDB cache.
 * For API routes, import from `@/app/services/indexerServer` instead.
 */

import {
  IndexerResultWithMeta,
  WrapPeriod,
  getCacheKey,
  isCacheValid,
  PERIODS,
} from "@/app/utils/indexer";
import { getCacheEntry, setCacheEntry } from "@/app/utils/indexedDbCache";
import { runIndexingCore } from "./indexerCore";
import { indexerWarn } from "@/app/utils/indexerDebug";
import { calculateAchievements } from "./achievementCalculator";

/** Ordered from narrowest to widest so we can walk upward for cache hits. */
const PERIOD_ORDER: WrapPeriod[] = ["weekly", "biweekly", "monthly", "yearly"];

/** Returns wider periods that could satisfy a narrower request. */
function widerPeriods(period: WrapPeriod): WrapPeriod[] {
  const idx = PERIOD_ORDER.indexOf(period);
  return PERIOD_ORDER.slice(idx + 1);
}

/**
 * Compute an IndexerResult for a narrower period by filtering
 * raw transactions from a wider cached fetch.
 */
function computeNarrowerResult(
  accountId: string,
  network: "mainnet" | "testnet",
  period: WrapPeriod,
  widerTransactions: unknown[],
): IndexerResult {
  const days = PERIODS[period];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const filtered = (widerTransactions as Array<{ created_at: string }>).filter(
    (tx) => new Date(tx.created_at) >= cutoffDate,
  );

  const result = calculateAchievements(filtered as Parameters<typeof calculateAchievements>[0]);
  result.accountId = accountId;
  return result;
}

/**
 * Index account with browser IndexedDB cache: return cached data if fresh,
 * else index and optionally return stale cache while re-indexing in background.
 *
 * When a narrower period is requested and no exact cache entry exists,
 * wider cached entries (which contain raw transactions) are used to
 * derive the narrower result in memory — avoiding duplicate Horizon requests.
 */
export async function indexAccount(
  accountId: string,
  network: "mainnet" | "testnet" = "mainnet",
  period: WrapPeriod = "monthly",
  options?: { bypassCache?: boolean },
): Promise<IndexerResultWithMeta> {
  const { bypassCache = false } = options ?? {};
  const cacheKey = getCacheKey(accountId, network, period);

  let cached: Awaited<ReturnType<typeof getCacheEntry>> | undefined;

  if (!bypassCache) {
    cached = await getCacheEntry(cacheKey);

    if (cached && isCacheValid(cached)) {
      return {
        result: cached.result,
        fromCache: true,
        cacheTimestamp: cached.timestamp,
      };
    }

    if (cached && !isCacheValid(cached)) {
      void runIndexingCore(accountId, network, period, true).then(
        (data) => {
          setCacheEntry(cacheKey, {
            result: data.result,
            timestamp: Date.now(),
            transactions: data.transactions,
          });
        },
        (err) => {
          indexerWarn("Background refresh failed", err);
        },
      );
      return {
        result: cached.result,
        fromCache: true,
        cacheTimestamp: cached.timestamp,
        refreshingInBackground: true,
      };
    }

    // No valid exact-period cache — check wider periods for raw transactions
    // so we can derive the narrower result without a Horizon request.
    for (const widerPeriod of widerPeriods(period)) {
      const widerKey = getCacheKey(accountId, network, widerPeriod);
      const widerCached = await getCacheEntry(widerKey);

      if (widerCached && isCacheValid(widerCached) && widerCached.transactions) {
        const narrowerResult = computeNarrowerResult(
          accountId,
          network,
          period,
          widerCached.transactions,
        );

        // Populate the narrower cache so future direct requests are also served.
        await setCacheEntry(cacheKey, {
          result: narrowerResult,
          timestamp: Date.now(),
          transactions: widerCached.transactions,
        });

        return {
          result: narrowerResult,
          fromCache: true,
          cacheTimestamp: widerCached.timestamp,
        };
      }
    }
  }

  try {
    const data = await runIndexingCore(accountId, network, period, false);
    await setCacheEntry(cacheKey, {
      result: data.result,
      timestamp: Date.now(),
      transactions: data.transactions,
    });
    return {
      result: data.result,
      fromCache: false,
    };
  } catch (error) {
    if (cached) {
      indexerWarn("Fresh indexing failed, using stale cache", error);
      return {
        result: cached.result,
        fromCache: true,
        cacheTimestamp: cached.timestamp,
        refreshingInBackground: false,
      };
    }
    throw error;
  }
}

export { runIndexingCore } from "./indexerCore";
