/**
 * Cache service for indexed data (Issue #48).
 * Wraps IndexedDB and provides get/set/invalidate/clear with key generation.
 */

import {
  getCacheKey as buildCacheKey,
  type IndexerResult,
  type WrapPeriod,
} from "@/app/utils/indexer";
import {
  getCacheEntry,
  setCacheEntry,
  invalidateCache as invalidateCacheEntry,
  clearCache as clearAllCache,
  getMostRecentCacheEntry,
} from "@/app/utils/indexedDbCache";

export type Network = "mainnet" | "testnet";

/**
 * Generate cache key: account_network_timeframe (collision-safe).
 */
export function getCachedDataKey(
  accountAddress: string,
  network: Network,
  timeframe: WrapPeriod,
): string {
  return buildCacheKey(accountAddress, network, timeframe);
}

/**
 * Retrieve from cache. Returns null on miss or error.
 */
export async function getCachedData(
  key: string,
): Promise<{ result: IndexerResult; timestamp: number } | null> {
  const entry = await getCacheEntry(key);
  return entry ? { result: entry.result, timestamp: entry.timestamp } : null;
}

export function parseCachedDataKey(
  key: string,
): { accountAddress: string; network: Network; timeframe: WrapPeriod } | null {
  const [accountAddress, network, timeframe] = key.split(":");
  if (
    !accountAddress ||
    !["mainnet", "testnet"].includes(network) ||
    !["weekly", "biweekly", "monthly", "yearly"].includes(timeframe)
  ) {
    return null;
  }

  return {
    accountAddress,
    network: network as Network,
    timeframe: timeframe as WrapPeriod,
  };
}

export async function getMostRecentCachedData(): Promise<{
  key: string;
  result: IndexerResult;
  timestamp: number;
} | null> {
  const entry = await getMostRecentCacheEntry();
  return entry
    ? { key: entry.key, result: entry.data.result, timestamp: entry.timestamp }
    : null;
}

/**
 * Store in cache.
 */
export async function setCachedData(
  key: string,
  data: { result: IndexerResult; timestamp: number },
): Promise<void> {
  await setCacheEntry(key, {
    result: data.result,
    timestamp: data.timestamp,
  });
}

/**
 * Clear a single cache entry.
 */
export async function invalidateCache(key: string): Promise<void> {
  await invalidateCacheEntry(key);
}

/**
 * Clear all cached indexed data.
 */
export async function clearCache(): Promise<void> {
  await clearAllCache();
}

// Re-export for consumers that need the low-level entry
export {
  getCacheEntry,
  setCacheEntry,
  getCacheTimestamp,
} from "@/app/utils/indexedDbCache";
