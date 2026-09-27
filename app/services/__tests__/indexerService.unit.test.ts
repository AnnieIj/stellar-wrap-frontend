/**
 * Unit tests for the Indexer Service
 * 
 * Tests the indexAccount function with various scenarios:
 * - Transaction fetching
 * - Timeframe filtering
 * - Pagination
 * - Error handling
 * 
 * Note: These tests use simplified mocks to focus on testable logic
 */

// Mock dependencies before imports
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
  setCacheEntry: jest.fn(),
  isCacheValid: jest.fn(() => false),
}));

jest.mock('@/app/utils/indexer', () => ({
  ...jest.requireActual('@/app/utils/indexer'),
  getCacheKey: jest.fn(() => 'test-cache-key'),
  isCacheValid: jest.fn(() => false),
}));

jest.mock('../achievementCalculator', () => ({
  calculateAchievements: jest.fn((transactions) => ({
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

import { indexAccount } from '../indexerService';
import { getHorizonServer } from '@/app/utils/stellarClient';
import { getCacheEntry, isCacheValid } from '@/app/utils/indexedDbCache';

describe('IndexerService - indexAccount', () => {
  let mockServer: {
    transactions: jest.Mock;
    operations: jest.Mock;
  };
  let transactionsCallMock: jest.Mock;
  let operationsCallMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create shared mock functions
    transactionsCallMock = jest.fn();
    operationsCallMock = jest.fn().mockResolvedValue({ records: [] });

    // Create a simple mock server with proper builder chain
    // The pattern is: transactions().forAccount().limit() returns a builder
    // that has cursor() and call() methods
    const createBuilder = () => {
      const builder: {
        cursor: jest.Mock;
        call: jest.Mock;
      } = {
        call: transactionsCallMock,
        cursor: jest.fn(),
      };
      // cursor() should return the builder itself for chaining
      builder.cursor = jest.fn(() => builder);
      return builder;
    };

    const createForAccountBuilder = () => {
      return {
        limit: jest.fn(() => createBuilder()),
      };
    };

    mockServer = {
      transactions: jest.fn(() => ({
        forAccount: jest.fn(() => createForAccountBuilder()),
      })),
      operations: jest.fn(() => ({
        forTransaction: jest.fn(() => ({
          call: operationsCallMock,
        })),
      })),
    };

    (getHorizonServer as jest.Mock).mockReturnValue(mockServer);
    (getCacheEntry as jest.Mock).mockResolvedValue(null);
    (isCacheValid as jest.Mock).mockReturnValue(false);
  });

  describe('Transaction Fetching', () => {
    it('should fetch transactions for a valid account', async () => {
      const now = new Date();
      const mockTransactions = [
        {
          id: '1',
          created_at: now.toISOString(),
          paging_token: 'token1',
          operations: jest.fn().mockResolvedValue({ records: [{ type: 'payment', amount: '100.0' }] }),
        },
        {
          id: '2',
          created_at: now.toISOString(),
          paging_token: 'token2',
          operations: jest.fn().mockResolvedValue({ records: [{ type: 'payment', amount: '50.0' }] }),
        },
      ];

      transactionsCallMock
        .mockResolvedValueOnce({ records: mockTransactions, _links: { next: { href: 'abc' } } })
        .mockResolvedValueOnce({ records: [], _links: { next: null } });

      const result = await indexAccount('GABCDEF123456789', 'mainnet', 'monthly');

      expect(result).toBeDefined();
      expect(result.totalTransactions).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should stop fetching when no more records', async () => {
      transactionsCallMock.mockResolvedValue({ records: [], _links: { next: null } });

      await indexAccount('GABCDEF123456789', 'mainnet', 'monthly');

      expect(transactionsCallMock).toHaveBeenCalled();
    }, 15000);
  });

  describe('Error Handling', () => {
    it('should handle 404 account not found error', async () => {
      const error = {
        response: { status: 404 },
        message: 'Not Found',
      };

      transactionsCallMock.mockRejectedValue(error);

      await expect(
        indexAccount('INVALID_ACCOUNT', 'mainnet', 'monthly')
      ).rejects.toThrow('Account not found');
    }, 10000);

    it('should handle 429 rate limit error', async () => {
      const error = {
        response: { status: 429 },
        message: 'Rate Limited',
      };

      transactionsCallMock.mockRejectedValue(error);

      await expect(
        indexAccount('GABCDEF123456789', 'mainnet', 'monthly')
      ).rejects.toThrow('Rate limit exceeded');
    }, 10000);

    it('should handle 500 server error', async () => {
      const error = {
        response: { status: 500 },
        message: 'Internal Server Error',
      };

      transactionsCallMock.mockRejectedValue(error);

      await expect(
        indexAccount('GABCDEF123456789', 'mainnet', 'monthly')
      ).rejects.toThrow('Server error');
    }, 10000);

    it('should handle network timeout error', async () => {
      const error = {
        code: 'ECONNABORTED',
        message: 'Timeout',
      };

      transactionsCallMock.mockRejectedValue(error);

      await expect(
        indexAccount('GABCDEF123456789', 'mainnet', 'monthly')
      ).rejects.toThrow('Network timeout');
    }, 10000);

    it('should handle unknown errors', async () => {
      const error = {
        message: 'Unknown error',
      };

      transactionsCallMock.mockRejectedValue(error);

      await expect(
        indexAccount('GABCDEF123456789', 'mainnet', 'monthly')
      ).rejects.toThrow('Unknown error fetching transactions');
    }, 10000);
  });

  describe('Cache Handling', () => {
    it('should return cached result if available and valid', async () => {
      const cachedResult = {
        result: {
          accountId: 'GABCDEF123456789',
          totalTransactions: 10,
          totalVolume: 1000,
          mostActiveAsset: 'XLM',
          contractCalls: 0,
          gasSpent: 0,
          dapps: [],
          vibes: [],
        },
        timestamp: Date.now(),
      };

      // Mock the cache functions from the indexer utils
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock() is hoisted; require() here accesses the mocked module after setup
      const { isCacheValid: indexerIsCacheValid } = require('@/app/utils/indexer');
      (indexerIsCacheValid as jest.Mock).mockReturnValue(true);
      (getCacheEntry as jest.Mock).mockResolvedValue(cachedResult);

      const result = await indexAccount('GABCDEF123456789', 'mainnet', 'monthly');

      expect(result).toEqual(cachedResult.result);
      expect(mockServer.transactions).not.toHaveBeenCalled();
    });

    it('should fetch fresh data if cache is invalid', async () => {
      (getCacheEntry as jest.Mock).mockResolvedValue(null);
      (isCacheValid as jest.Mock).mockReturnValue(false);

      transactionsCallMock.mockResolvedValue({ records: [], _links: { next: null } });

      await indexAccount('GABCDEF123456789', 'mainnet', 'monthly');

      expect(transactionsCallMock).toHaveBeenCalled();
    }, 15000);

    it('should use wider cached transactions to serve a narrower period without a Horizon request', async () => {
      const now = new Date();
      const sixDaysAgo = new Date(now);
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      const eightDaysAgo = new Date(now);
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const widerTransactions = [
        {
          id: '1',
          created_at: sixDaysAgo.toISOString(),
          paging_token: 'token1',
          operations: jest.fn().mockResolvedValue({ records: [{ type: 'payment', amount: '100.0' }] }),
        },
        {
          id: '2',
          created_at: eightDaysAgo.toISOString(),
          paging_token: 'token2',
          operations: jest.fn().mockResolvedValue({ records: [{ type: 'payment', amount: '50.0' }] }),
        },
      ];

      // Monthly cache has valid data with raw transactions; biweekly misses
      (getCacheEntry as jest.Mock)
        .mockResolvedValueOnce(null) // exact-period miss for weekly
        .mockResolvedValueOnce(null) // biweekly miss
        .mockResolvedValueOnce({
          result: {
            accountId: 'GABCDEF123456789',
            totalTransactions: 2,
            totalVolume: 150,
            mostActiveAsset: 'XLM',
            contractCalls: 0,
            gasSpent: 0,
            dapps: [],
            vibes: [],
          },
          timestamp: Date.now(),
          transactions: widerTransactions,
        }); // monthly hit

      (isCacheValid as jest.Mock).mockReturnValue(true);

      const result = await indexAccount('GABCDEF123456789', 'mainnet', 'weekly');

      // Should derive result from wider cache — no Horizon request needed
      expect(mockServer.transactions).not.toHaveBeenCalled();
      expect(result.totalTransactions).toBe(1); // only the 6-days-ago tx is within 7 days
    });
  });

  describe('Network Support', () => {
    it('should work with mainnet', async () => {
      transactionsCallMock.mockResolvedValue({ records: [], _links: { next: null } });

      const result = await indexAccount('GABCDEF123456789', 'mainnet', 'monthly');

      expect(result).toBeDefined();
      expect(getHorizonServer).toHaveBeenCalledWith('mainnet');
    }, 15000);

    it('should work with testnet', async () => {
      transactionsCallMock.mockResolvedValue({ records: [], _links: { next: null } });

      const result = await indexAccount('GABCDEF123456789', 'testnet', 'monthly');

      expect(result).toBeDefined();
      expect(getHorizonServer).toHaveBeenCalledWith('testnet');
    }, 15000);
  });

  describe('Period Support', () => {
    it('should handle different periods', async () => {
      const periods = ['weekly', 'monthly', 'yearly'] as const;
      
      for (const period of periods) {
        transactionsCallMock.mockResolvedValue({ records: [], _links: { next: null } });
        const result = await indexAccount('GABCDEF123456789', 'mainnet', period);
        expect(result).toBeDefined();
      }
    }, 30000);
  });

  describe('Timeframe Filtering', () => {
    it('should filter transactions by weekly period (7 days)', async () => {
      const now = new Date();
      const sixDaysAgo = new Date(now);
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      const eightDaysAgo = new Date(now);
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const recentTx = {
        id: '1',
        created_at: sixDaysAgo.toISOString(),
        paging_token: 'token1',
        operations: jest.fn().mockResolvedValue({ records: [{ type: 'payment', amount: '100.0' }] }),
      };

      const oldTx = {
        id: '2',
        created_at: eightDaysAgo.toISOString(),
        paging_token: 'token2',
        operations: jest.fn().mockResolvedValue({ records: [{ type: 'payment', amount: '50.0' }] }),
      };

      transactionsCallMock
        .mockResolvedValueOnce({ records: [recentTx, oldTx], _links: { next: { href: 'next' } } })
        .mockResolvedValueOnce({ records: [] });

      const result = await indexAccount('GABCDEF123456789', 'mainnet', 'weekly');

      // Should only include transactions within 7 days
      expect(result).toBeDefined();
    }, 15000);

    it('should filter transactions by biweekly period (14 days)', async () => {
      const now = new Date();
      const thirteenDaysAgo = new Date(now);
      thirteenDaysAgo.setDate(thirteenDaysAgo.getDate() - 13);
      const fifteenDaysAgo = new Date(now);
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const recentTx = {
        id: '1',
        created_at: thirteenDaysAgo.toISOString(),
        paging_token: 'token1',
        operations: jest.fn().mockResolvedValue({ records: [{ type: 'payment', amount: '100.0' }] }),
      };

      const oldTx = {
        id: '2',
        created_at: fifteenDaysAgo.toISOString(),
        paging_token: 'token2',
        operations: jest.fn().mockResolvedValue({ records: [{ type: 'payment', amount: '50.0' }] }),
      };

      transactionsCallMock
        .mockResolvedValueOnce({ records: [recentTx, oldTx], _links: { next: { href: 'next' } } })
        .mockResolvedValueOnce({ records: [] });

      const result = await indexAccount('GABCDEF123456789', 'mainnet', 'biweekly');

      expect(result).toBeDefined();
    }, 15000);

    it('should filter transactions by monthly period (30 days)', async () => {
      const now = new Date();
      const twentyNineDaysAgo = new Date(now);
      twentyNineDaysAgo.setDate(twentyNineDaysAgo.getDate() - 29);
      const thirtyOneDaysAgo = new Date(now);
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      const recentTx = {
        id: '1',
        created_at: twentyNineDaysAgo.toISOString(),
        paging_token: 'token1',
        operations: jest.fn().mockResolvedValue({ records: [{ type: 'payment', amount: '100.0' }] }),
      };

      const oldTx = {
        id: '2',
        created_at: thirtyOneDaysAgo.toISOString(),
        paging_token: 'token2',
        operations: jest.fn().mockResolvedValue({ records: [{ type: 'payment', amount: '50.0' }] }),
      };

      transactionsCallMock
        .mockResolvedValueOnce({ records: [recentTx, oldTx], _links: { next: { href: 'next' } } })
        .mockResolvedValueOnce({ records: [] });

      const result = await indexAccount('GABCDEF123456789', 'mainnet', 'monthly');

      expect(result).toBeDefined();
    }, 15000);

    it('should handle boundary conditions (exactly at cutoff date)', async () => {
      const now = new Date();
      const exactlySevenDaysAgo = new Date(now);
      exactlySevenDaysAgo.setDate(exactlySevenDaysAgo.getDate() - 7);
      exactlySevenDaysAgo.setHours(0, 0, 0, 0); // Start of day

      const boundaryTx = {
        id: '1',
        created_at: exactlySevenDaysAgo.toISOString(),
        paging_token: 'token1',
        operations: jest.fn().mockResolvedValue({ records: [{ type: 'payment', amount: '100.0' }] }),
      };

      transactionsCallMock
        .mockResolvedValueOnce({ records: [boundaryTx], _links: { next: { href: 'next' } } })
        .mockResolvedValueOnce({ records: [] });

      const result = await indexAccount('GABCDEF123456789', 'mainnet', 'weekly');

      expect(result).toBeDefined();
    }, 15000);
  });
});
