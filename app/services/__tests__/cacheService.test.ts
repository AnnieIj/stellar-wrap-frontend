import {
  getCachedData,
  setCachedData,
  invalidateCache,
  clearCache,
  getMostRecentCachedData,
  parseCachedDataKey,
  getCachedDataKey,
} from '../cacheService';
import { IndexerResult } from '@/app/utils/indexer';

jest.mock('@/app/utils/indexedDbCache', () => ({
  getCacheEntry: jest.fn(),
  setCacheEntry: jest.fn(),
  invalidateCache: jest.fn(),
  clearCache: jest.fn(),
  getMostRecentCacheEntry: jest.fn(),
}));

jest.mock('@/app/utils/indexer', () => ({
  getCacheKey: jest.fn((accountId, network, period) => `${accountId}:${network}:${period}:1`),
  buildCacheKey: jest.fn((accountId, network, period) => `${accountId}:${network}:${period}:1`),
}));

import { getCacheEntry, setCacheEntry, invalidateCache as invalidateCacheEntry, clearCache as clearAllCache, getMostRecentCacheEntry } from '@/app/utils/indexedDbCache';

describe('cacheService', () => {
  const mockResult: IndexerResult = {
    accountId: 'GABC123',
    totalTransactions: 42,
    totalVolume: 1000,
    mostActiveAsset: 'XLM',
    contractCalls: 5,
    gasSpent: 0.5,
    dapps: [],
    vibes: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCachedData', () => {
    it('returns null on cache miss', async () => {
      (getCacheEntry as jest.Mock).mockResolvedValue(null);
      const result = await getCachedData('test-key');
      expect(result).toBeNull();
    });

    it('returns cached result on cache hit', async () => {
      const entry = { result: mockResult, timestamp: Date.now() };
      (getCacheEntry as jest.Mock).mockResolvedValue(entry);
      const result = await getCachedData('test-key');
      expect(result).toEqual(entry);
    });
  });

  describe('setCachedData', () => {
    it('stores data in cache', async () => {
      await setCachedData('test-key', { result: mockResult, timestamp: Date.now() });
      expect(setCacheEntry).toHaveBeenCalledWith('test-key', {
        result: mockResult,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('invalidateCache', () => {
    it('removes a single cache entry', async () => {
      await invalidateCache('test-key');
      expect(invalidateCacheEntry).toHaveBeenCalledWith('test-key');
    });
  });

  describe('clearCache', () => {
    it('clears all cache entries', async () => {
      await clearCache();
      expect(clearAllCache).toHaveBeenCalled();
    });
  });

  describe('getMostRecentCachedData', () => {
    it('returns null when no cache entries exist', async () => {
      (getMostRecentCacheEntry as jest.Mock).mockResolvedValue(null);
      const result = await getMostRecentCachedData();
      expect(result).toBeNull();
    });

    it('returns most recent cache entry', async () => {
      const entry = {
        key: 'test-key',
        data: { result: mockResult, timestamp: Date.now() },
        timestamp: Date.now(),
      };
      (getMostRecentCacheEntry as jest.Mock).mockResolvedValue(entry);
      const result = await getMostRecentCachedData();
      expect(result).toEqual({
        key: 'test-key',
        result: mockResult,
        timestamp: entry.timestamp,
      });
    });
  });

  describe('parseCachedDataKey', () => {
    it('parses valid cache key', () => {
      const key = 'GABC123:mainnet:monthly:1';
      const parsed = parseCachedDataKey(key);
      expect(parsed).toEqual({
        accountAddress: 'GABC123',
        network: 'mainnet',
        timeframe: 'monthly',
      });
    });

    it('returns null for invalid cache key', () => {
      expect(parseCachedDataKey('invalid')).toBeNull();
      expect(parseCachedDataKey('')).toBeNull();
    });
  });

  describe('getCachedDataKey', () => {
    it('generates cache key from parameters', () => {
      const key = getCachedDataKey('GABC123', 'mainnet', 'monthly');
      expect(key).toContain('GABC123');
      expect(key).toContain('mainnet');
      expect(key).toContain('monthly');
    });
  });
});
