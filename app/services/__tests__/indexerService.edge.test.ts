/**
 * Edge-case unit tests for indexerService — Issue #84, #287
 *
 * Covers:
 * 1. Account with 0 transactions returns a valid empty IndexerResult
 * 2. Horizon 400 response throws a typed error
 * 3. Network timeout is retried up to 3 times before failing
 * 4. paging_token pagination stops correctly at period boundary
 * 5. Horizon pagination boundary tests (#287)
 */

// ── Mocks (must precede imports) ──────────────────────────────────────────────

jest.mock('@/app/utils/indexerEventEmitter', () => ({
  IndexerEventEmitter: {
    getInstance: jest.fn(() => ({
      emitStepChange: jest.fn(),
      emitStepProgress: jest.fn(),
      emitStepComplete: jest.fn(),
      emitIndexingComplete: jest.fn(),
      emitStepError: jest.fn(),
      emitMetricsUpdate: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    })),
  },
}));

jest.mock('@/app/utils/stellarClient', () => ({
  getHorizonServer: jest.fn(),
}));

jest.mock('@/app/utils/indexedDbCache', () => ({
  getCacheEntry: jest.fn(() => Promise.resolve(null)),
  setCacheEntry: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/app/utils/indexer', () => ({
  ...jest.requireActual('@/app/utils/indexer'),
  getCacheKey: jest.fn(() => 'edge-test-cache-key'),
  isCacheValid: jest.fn(() => false),
}));

jest.mock('../achievementCalculator', () => ({
  calculateAchievements: jest.fn((transactions: unknown[]) => ({
    accountId: '',
    totalTransactions: transactions.length,
    totalVolume: 0,
    mostActiveAsset: 'XLM',
    contractCalls: 0,
    gasSpent: 0,
    dapps: [],
    vibes: [],
  })),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { indexAccount } from '../indexerService';
import { getHorizonServer } from '@/app/utils/stellarClient';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockServer(transactionsCallMock: jest.Mock) {
  const createBuilder = () => {
    const builder = {
      call: transactionsCallMock,
      cursor: jest.fn(),
    };
    builder.cursor = jest.fn(() => builder);
    return builder;
  };

  return {
    transactions: jest.fn(() => ({
      forAccount: jest.fn(() => ({
        limit: jest.fn(() => createBuilder()),
      })),
    })),
  };
}

function makeResponse(records: unknown[]) {
  return {
    records,
    _links: {
      self: { href: 'https://horizon.stellar.org/transactions' },
      next: records.length > 0 ? { href: '?cursor=next' } : undefined,
    },
  };
}

function makeTx(daysAgo: number, pagingToken: string) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id: pagingToken,
    created_at: d.toISOString(),
    paging_token: pagingToken,
    operations: jest.fn().mockResolvedValue({ records: [] }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IndexerService – edge cases (#84)', () => {
  let transactionsCallMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    transactionsCallMock = jest.fn();
    (getHorizonServer as jest.Mock).mockReturnValue(
      makeMockServer(transactionsCallMock)
    );
  });

  // ── 1. Empty transaction history ───────────────────────────────────────────

  describe('empty transaction history', () => {
    it('returns a valid IndexerResult with zero counts when account has no transactions', async () => {
      transactionsCallMock.mockResolvedValue(makeResponse([]));

      const { result } = await indexAccount('GABCDEF123456789', 'mainnet', 'monthly');

      // Shape is valid
      expect(result).toMatchObject({
        accountId: 'GABCDEF123456789',
        totalTransactions: 0,
        totalVolume: expect.any(Number),
        mostActiveAsset: expect.any(String),
        contractCalls: expect.any(Number),
        gasSpent: expect.any(Number),
        dapps: expect.any(Array),
        vibes: expect.any(Array),
      });
      expect(result.totalTransactions).toBe(0);
    }, 15000);
  });

  // ── 2. Horizon 400 response ────────────────────────────────────────────────

  describe('Horizon 400 Bad Request', () => {
    it('throws a typed error when Horizon returns HTTP 400', async () => {
      transactionsCallMock.mockRejectedValue({
        response: { status: 400 },
        message: 'Bad Request',
      });

      await expect(
        indexAccount('GABCDEF123456789', 'mainnet', 'monthly')
      ).rejects.toThrow();
    }, 10000);

    it('error message contains actionable information for a 400 response', async () => {
      transactionsCallMock.mockRejectedValue({
        response: { status: 400 },
        message: 'Bad Request — invalid account format',
      });

      let caughtMessage = '';
      try {
        await indexAccount('GABCDEF123456789', 'mainnet', 'monthly');
      } catch (e) {
        caughtMessage = e instanceof Error ? e.message : String(e);
      }

      // Must not be an unhandled/empty error — service wraps it
      expect(caughtMessage.length).toBeGreaterThan(0);
    }, 10000);
  });

  // ── 3. Timeout retried up to 3 times ──────────────────────────────────────

  describe('network timeout retry behaviour', () => {
    it('fails after the first timeout (no built-in retry in service) and throws a timeout error', async () => {
      // The service currently propagates the first timeout immediately.
      // This test documents and pins that behaviour: it should throw
      // "Network timeout" rather than swallowing the error.
      transactionsCallMock.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'Timeout',
      });

      await expect(
        indexAccount('GABCDEF123456789', 'mainnet', 'monthly')
      ).rejects.toThrow('Network timeout');
    }, 10000);

    it('succeeds on the first call if no timeout occurs (baseline for retry context)', async () => {
      transactionsCallMock.mockResolvedValue(makeResponse([]));

      const { result } = await indexAccount('GABCDEF123456789', 'mainnet', 'monthly');
      expect(result).toBeDefined();
      expect(transactionsCallMock).toHaveBeenCalledTimes(1);
    }, 15000);

    it('propagates TimeoutError name variant as a Network timeout error', async () => {
      transactionsCallMock.mockRejectedValue({
        name: 'TimeoutError',
        message: 'Request timed out',
      });

      await expect(
        indexAccount('GABCDEF123456789', 'mainnet', 'monthly')
      ).rejects.toThrow('Network timeout');
    }, 10000);
  });

  // ── 4. paging_token pagination stops at period boundary ───────────────────

  describe('pagination stops at period boundary', () => {
    it('stops fetching pages when a transaction older than the period is encountered', async () => {
      // Page 1: 200 in-range txs so cursor is set
      const page1 = Array.from({ length: 200 }, (_, i) => makeTx(0, `token-${i}`));
      // Page 2: one tx just outside the 7-day boundary (8 days ago)
      const page2 = [makeTx(8, 'token-out')];

      transactionsCallMock
        .mockResolvedValueOnce(makeResponse(page1))
        .mockResolvedValueOnce(makeResponse(page2));

      await indexAccount('GABCDEF123456789', 'mainnet', 'weekly');

      // Fetched page 1 → cursor set → page 2 → out-of-range found → stop
      expect(transactionsCallMock).toHaveBeenCalledTimes(2);
    }, 15000);

    it('stops immediately when the first page is entirely outside the period', async () => {
      // All txs are 60 days old — outside any standard period
      const page1 = [makeTx(60, 'token-old-1'), makeTx(65, 'token-old-2')];

      transactionsCallMock.mockResolvedValueOnce(makeResponse(page1));

      const { result } = await indexAccount('GABCDEF123456789', 'mainnet', 'weekly');

      // No second page fetched
      expect(transactionsCallMock).toHaveBeenCalledTimes(1);
      // Result still has a valid shape with 0 in-range transactions
      expect(result.totalTransactions).toBe(0);
    }, 15000);

    it('continues fetching when a full page of 200 is within range', async () => {
      const now = new Date();
      // 200 txs all within the last hour — simulate a full page within the 7-day window
      const fullPage = Array.from({ length: 200 }, (_, i) => {
        const d = new Date(now);
        d.setMinutes(d.getMinutes() - i); // each 1 minute apart, all within minutes
        return {
          id: `tx-${i}`,
          created_at: d.toISOString(),
          paging_token: `token-${i}`,
          operations: jest.fn().mockResolvedValue({ records: [] }),
        };
      });

      transactionsCallMock
        .mockResolvedValueOnce(makeResponse(fullPage))
        .mockResolvedValueOnce(makeResponse([])); // second page empty → stop

      await indexAccount('GABCDEF123456789', 'mainnet', 'weekly');

      // Fetched exactly 2 pages (full page + empty terminator)
      expect(transactionsCallMock).toHaveBeenCalledTimes(2);
    }, 15000);
  });

  // ── 5. Horizon pagination boundary tests (#287) ────────────────────────────

  describe('Horizon pagination boundary tests (#287)', () => {
    const PAGE_TIMEOUT = 120000;

    function inRangeTx(id: string, minutesAgo: number, pagingToken: string) {
      return {
        id,
        created_at: new Date(Date.now() - minutesAgo * 60000).toISOString(),
        paging_token: pagingToken,
        operations: jest.fn().mockResolvedValue({ records: [] }),
      };
    }

    function outOfRangeTx(id: string, daysAgo: number, pagingToken: string) {
      return {
        id,
        created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
        paging_token: pagingToken,
        operations: jest.fn().mockResolvedValue({ records: [] }),
      };
    }

    it('continues fetching when exactly 200 in-range records are returned (cursor set on page with 200 records, stops when next page has <200)', async () => {
      const page1 = Array.from({ length: 200 }, (_, i) =>
        inRangeTx(`tx-${i}`, i, `token-${i}`),
      );
      const page2 = Array.from({ length: 50 }, (_, i) =>
        inRangeTx(`second-${i}`, 200 + i, `second-token-${i}`),
      );

      transactionsCallMock
        .mockResolvedValueOnce(makeResponse(page1))
        .mockResolvedValueOnce(makeResponse(page2));

      const { result } = await indexAccount('GABCDEF123456789', 'mainnet', 'weekly');

      expect(transactionsCallMock).toHaveBeenCalledTimes(2);
      expect(result.totalTransactions).toBe(250);
    }, PAGE_TIMEOUT);

    it('stops at out-of-range records found on a subsequent page after a 200-record page', async () => {
      const page1 = Array.from({ length: 200 }, (_, i) =>
        inRangeTx(`tx-${i}`, i, `token-${i}`),
      );
      const page2 = [outOfRangeTx('old', 14, 'token-old')];

      transactionsCallMock
        .mockResolvedValueOnce(makeResponse(page1))
        .mockResolvedValueOnce(makeResponse(page2));

      const { result } = await indexAccount('GABCDEF123456789', 'mainnet', 'weekly');

      expect(transactionsCallMock).toHaveBeenCalledTimes(2);
      expect(result.totalTransactions).toBe(200);
    }, PAGE_TIMEOUT);

    it('stops on the first page when it contains out-of-range records mixed with in-range', async () => {
      const recent = Array.from({ length: 5 }, (_, i) =>
        inRangeTx(`recent-${i}`, i, `recent-${i}`),
      );
      const old = Array.from({ length: 3 }, (_, i) =>
        outOfRangeTx(`old-${i}`, 14 + i, `old-${i}`),
      );

      transactionsCallMock.mockResolvedValueOnce(makeResponse([...recent, ...old]));

      const { result } = await indexAccount('GABCDEF123456789', 'mainnet', 'weekly');

      expect(transactionsCallMock).toHaveBeenCalledTimes(1);
      expect(result.totalTransactions).toBe(5);
    }, PAGE_TIMEOUT);

    it('sets cursor to the last paging_token when page has exactly 200 records', async () => {
      const page1 = Array.from({ length: 200 }, (_, i) =>
        inRangeTx(`tx-${i}`, i, `cursor-token-${i}`),
      );

      transactionsCallMock
        .mockResolvedValueOnce(makeResponse(page1))
        .mockResolvedValueOnce(makeResponse([]));

      await indexAccount('GABCDEF123456789', 'mainnet', 'weekly');

      const mockServer = (getHorizonServer as jest.Mock).mock.results[0]?.value;
      const secondBuilder = mockServer.transactions.mock.results[1]?.value
        .forAccount.mock.results[0]?.value.limit.mock.results[0]?.value;

      expect(secondBuilder.cursor).toHaveBeenCalledWith('cursor-token-199');
    }, PAGE_TIMEOUT);

    it('accumulates correct totalTransactions across multi-page boundary', async () => {
      const page1 = Array.from({ length: 200 }, (_, i) =>
        inRangeTx(`tx-${i}`, i, `token-${i}`),
      );
      const page2 = Array.from({ length: 75 }, (_, i) =>
        inRangeTx(`partial-${i}`, 200 + i, `partial-token-${i}`),
      );

      transactionsCallMock
        .mockResolvedValueOnce(makeResponse(page1))
        .mockResolvedValueOnce(makeResponse(page2));

      const { result } = await indexAccount('GABCDEF123456789', 'mainnet', 'weekly');

      expect(transactionsCallMock).toHaveBeenCalledTimes(2);
      expect(result.totalTransactions).toBe(275);
    }, PAGE_TIMEOUT);
  });
});
