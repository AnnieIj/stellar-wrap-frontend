/**
 * Tests for IndexedDB cache versioning and graceful invalidation.
 */

import { getCacheEntry, setCacheEntry, getAllCacheEntries, clearCache, CACHE_VERSION } from '../indexedDbCache';

function mockIndexedDB(records: Map<string, { data: any; timestamp: number }>) {
  const store: Map<string, any> = new Map(records);

  const mockDB = {
    transaction: (storeName: string, mode: string) => ({
      objectStore: (storeName: string) => ({
        get: (key: string) => ({
          onsuccess: () => {
            const record = store.get(key);
            if (!record) {
              mockDB.transaction.onsuccess?.();
              return;
            }
            mockDB.transaction.result = { key, data: record.data, timestamp: record.timestamp };
            mockDB.transaction.onsuccess?.();
          },
          result: undefined as any,
        }),
        put: (record: any) => {
          store.set(record.key, { data: record.data, timestamp: record.timestamp });
          mockDB.transaction.oncomplete?.();
        },
        delete: (key: string) => {
          store.delete(key);
          mockDB.transaction.onsuccess?.();
        },
        clear: () => {
          store.clear();
          mockDB.transaction.onsuccess?.();
        },
        getAll: () => ({
          onsuccess: () => {
            mockDB.transaction.result = Array.from(store.entries()).map(([key, value]) => ({
              key,
              data: value.data,
              timestamp: value.timestamp,
            }));
            mockDB.transaction.onsuccess?.();
          },
          result: [] as any[],
        }),
      }),
    }),
    onupgradeneeded: null as any,
    onsuccess: null as any,
    onerror: null as any,
    close: () => {},
  };

  mockDB.transaction = {
    onsuccess: null as (() => void) | undefined,
    oncomplete: null as (() => void) | undefined,
    onerror: null as ((err: any) => void) | undefined,
    result: undefined as any,
  };

  (global as any).indexedDB = {
    open: (dbName: string, version: number) => {
      const request = {
        result: mockDB,
        onsuccess: null as (() => void) | undefined,
        onerror: null as ((err: any) => void) | undefined,
        onupgradeneeded: null as (() => void) | undefined,
      };
      request.onsuccess = mockDB.onsuccess;
      request.onerror = mockDB.onerror;
      request.onupgradeneeded = mockDB.onupgradeneeded;
      return request;
    },
  };

  return { mockDB, store };
}

describe('indexedDbCache versioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    (global as any).indexedDB = undefined;
  });

  it('returns null for cache entry with mismatched version', async () => {
    const { mockDB } = mockIndexedDB(new Map());

    const oldVersion = CACHE_VERSION + 1;
    const key = `GABC:mainnet:monthly:${oldVersion}`;
    const entry = {
      result: { accountId: 'GABC', totalTransactions: 5 },
      timestamp: Date.now(),
      version: oldVersion,
    };

    await setCacheEntry(key, entry);

    const retrieved = await getCacheEntry(key);
    expect(retrieved).toBeNull();
  });

  it('returns cache entry when version matches', async () => {
    const { mockDB } = mockIndexedDB(new Map());

    const key = `GABC:mainnet:monthly:${CACHE_VERSION}`;
    const entry = {
      result: { accountId: 'GABC', totalTransactions: 5 },
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };

    await setCacheEntry(key, entry);

    const retrieved = await getCacheEntry(key);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.result.accountId).toBe('GABC');
  });

  it('filters out old version entries in getAllCacheEntries', async () => {
    const { mockDB, store } = mockIndexedDB(new Map());

    const newKey = `GABC:mainnet:monthly:${CACHE_VERSION}`;
    const oldKey = `GDEF:mainnet:monthly:${CACHE_VERSION + 1}`;

    await setCacheEntry(newKey, {
      result: { accountId: 'GABC', totalTransactions: 5 },
      timestamp: Date.now(),
      version: CACHE_VERSION,
    });

    await setCacheEntry(oldKey, {
      result: { accountId: 'GDEF', totalTransactions: 3 },
      timestamp: Date.now(),
      version: CACHE_VERSION + 1,
    });

    const all = await getAllCacheEntries();
    expect(all).toHaveLength(1);
    expect(all[0].key).toBe(newKey);
  });
});
