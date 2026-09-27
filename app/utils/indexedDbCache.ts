/**
 * IndexedDB cache for Stellar indexer results (Issue #48).
 * Database: stellar-wrap-cache, store: indexedData
 * Schema: { key, data, timestamp } with size limit and eviction.
 */

import type { CacheEntry } from "./indexer";
import { CACHE_VERSION } from "./indexer";
import { logger } from "./logger";

const log = logger.child("IndexedDbCache");

const DB_NAME = "stellar-wrap-cache";
const STORE_NAME = "indexedData";
const DB_VERSION = 1;
/** Max number of cache entries; evict oldest when exceeded (~10MB with large payloads). */
const MAX_CACHE_KEYS = 50;

export interface StoredCacheRecord {
  key: string;
  data: CacheEntry;
  timestamp: number;
}

let dbInstance: IDBDatabase | null = null;

function openCacheDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

function closeCacheDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Get a cache entry by key. Returns null on miss or on error (with console warning).
 */
export async function getCacheEntry(key: string): Promise<CacheEntry | null> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const row = request.result as StoredCacheRecord | undefined;
        if (!row?.data) {
          resolve(null);
          return;
        }
        const entry = row.data as CacheEntry;
        if (entry.version !== undefined && entry.version !== CACHE_VERSION) {
          resolve(null);
          return;
        }
        resolve(entry);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    log.warn("getCacheEntry failed:", error);
    return null;
  }
}

/**
 * Store a cache entry. Evicts oldest entries if over MAX_CACHE_KEYS.
 */
export async function setCacheEntry(
  key: string,
  value: CacheEntry,
): Promise<void> {
  try {
    const db = await openCacheDB();
    const record: StoredCacheRecord = {
      key,
      data: { ...value, version: value.version ?? CACHE_VERSION },
      timestamp: value.timestamp,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await evictIfOverLimit(db);
  } catch (error) {
    log.warn("setCacheEntry failed:", error);
    try {
      closeCacheDB();
    } catch {
      // ignore
    }
  }
}

/**
 * Remove a single cache entry by key.
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    log.warn("invalidateCache failed:", error);
  }
}

/**
 * Clear all cache entries.
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    log.warn("clearCache failed:", error);
  } finally {
    closeCacheDB();
  }
}

/**
 * Get cache metadata (timestamp) for a key, for UI (e.g. "cached 5m ago").
 */
export async function getCacheTimestamp(key: string): Promise<number | null> {
  const entry = await getCacheEntry(key);
  return entry ? entry.timestamp : null;
}

/**
 * Get all cache rows. Used for offline recovery where the app needs the most
 * recent viewed wrap even if the current route has no wallet context.
 */
export async function getAllCacheEntries(): Promise<StoredCacheRecord[]> {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const rows = (request.result ?? []) as StoredCacheRecord[];
        resolve(
          rows.filter((row) => {
            const entry = row.data;
            return entry?.version === undefined || entry.version === CACHE_VERSION;
          }),
        );
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    log.warn("getAllCacheEntries failed:", error);
    return [];
  }
}

/**
 * Return the newest cached wrap result, regardless of TTL.
 */
export async function getMostRecentCacheEntry(): Promise<StoredCacheRecord | null> {
  const rows = await getAllCacheEntries();
  if (!rows.length) return null;
  return rows.reduce((latest, row) =>
    row.timestamp > latest.timestamp ? row : latest,
  );
}

async function evictIfOverLimit(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const rows = (request.result ?? []) as StoredCacheRecord[];
      if (rows.length <= MAX_CACHE_KEYS) {
        resolve();
        return;
      }
      const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = sorted.slice(0, rows.length - MAX_CACHE_KEYS);
      toRemove.forEach((r) => store.delete(r.key));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}
