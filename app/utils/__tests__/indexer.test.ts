import { getCacheKey, isCacheValid, CACHE_VERSION, CACHE_TTL_MINUTES, normalizePeriod } from '../indexer';

describe('indexer utils', () => {
  describe('normalizePeriod', () => {
    it('returns a valid WrapPeriod for lowercase input', () => {
      expect(normalizePeriod('weekly')).toBe('weekly');
      expect(normalizePeriod('monthly')).toBe('monthly');
      expect(normalizePeriod('yearly')).toBe('yearly');
      expect(normalizePeriod('biweekly')).toBe('biweekly');
    });

    it('normalizes uppercase input to lowercase', () => {
      expect(normalizePeriod('WEEKLY')).toBe('weekly');
      expect(normalizePeriod('Monthly')).toBe('monthly');
      expect(normalizePeriod('YEARLY')).toBe('yearly');
    });

    it('normalizes mixed-case input', () => {
      expect(normalizePeriod('WeEkLy')).toBe('weekly');
    });

    it('trims whitespace', () => {
      expect(normalizePeriod('  monthly  ')).toBe('monthly');
    });

    it('returns null for invalid period strings', () => {
      expect(normalizePeriod('daily')).toBeNull();
      expect(normalizePeriod('quarterly')).toBeNull();
      expect(normalizePeriod('')).toBeNull();
      expect(normalizePeriod('   ')).toBeNull();
    });

    it('returns null for null or undefined', () => {
      expect(normalizePeriod(null)).toBeNull();
      expect(normalizePeriod(undefined)).toBeNull();
    });
  });

  describe('getCacheKey', () => {
    it('includes accountId, network, period, and cache version', () => {
      const key = getCacheKey('GABC', 'mainnet', 'monthly');
      expect(key).toBe(`GABC:mainnet:monthly:${CACHE_VERSION}`);
    });

    it('changes when cache version changes', () => {
      const currentKey = getCacheKey('GABC', 'mainnet', 'monthly');
      const previousVersion = CACHE_VERSION + 1;
      const previousKey = `GABC:mainnet:monthly:${previousVersion}`;
      expect(currentKey).not.toBe(previousKey);
    });
  });

  describe('isCacheValid', () => {
    it('returns true for fresh entries within TTL', () => {
      const entry = { result: {} as any, timestamp: Date.now() };
      expect(isCacheValid(entry)).toBe(true);
    });

    it('returns false for stale entries beyond TTL', () => {
      const staleTimestamp = Date.now() - (CACHE_TTL_MINUTES + 1) * 60 * 1000;
      const entry = { result: {} as any, timestamp: staleTimestamp };
      expect(isCacheValid(entry)).toBe(false);
    });

    it('respects custom TTL', () => {
      const recentTimestamp = Date.now() - 30 * 60 * 1000;
      const entry = { result: {} as any, timestamp: recentTimestamp };
      expect(isCacheValid(entry, 60)).toBe(false);
      expect(isCacheValid(entry, 30)).toBe(true);
    });
  });
});
