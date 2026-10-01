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

    // The 60-minute window is the documented caching contract (issue #623).
    // Testing only "well inside" and "well outside" leaves the boundary
    // itself, where an off-by-one flips the behaviour, unverified.
    describe('60-minute TTL boundary', () => {
      const TTL_MS = CACHE_TTL_MINUTES * 60 * 1000;
      const NOW = Date.parse('2026-09-25T12:00:00.000Z');

      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(NOW);
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('is valid one millisecond inside the window', () => {
        const entry = { result: {} as any, timestamp: NOW - (TTL_MS - 1) };
        expect(isCacheValid(entry)).toBe(true);
      });

      it('is invalid at exactly the 60-minute boundary', () => {
        const entry = { result: {} as any, timestamp: NOW - TTL_MS };
        expect(isCacheValid(entry)).toBe(false);
      });

      it('is invalid one millisecond past the boundary', () => {
        const entry = { result: {} as any, timestamp: NOW - (TTL_MS + 1) };
        expect(isCacheValid(entry)).toBe(false);
      });
    });
  });
});
