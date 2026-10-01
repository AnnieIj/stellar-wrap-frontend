/**
 * Unit tests for useTransactionHistory hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useTransactionHistory } from './useTransactionHistory';
import { horizonIndexer } from '@/src/services/horizonIndexer';
import type { Horizon } from 'stellar-sdk';

// Mock the Horizon indexer
jest.mock('@/src/services/horizonIndexer');

// Mock data
const mockHorizonTransaction: Horizon.ServerApi.TransactionRecord = {
  id: '123456',
  hash: 'abc123def456',
  created_at: '2024-01-15T10:30:00Z',
  source_account: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGQ5P5XG',
  source_account_sequence: '1',
  fee_charged: '100',
  max_fee: '100',
  operation_count: 1,
  ledger_sequence: 12345,
  successful: true,
  memo_type: 'text',
  memo: 'Test memo',
  _links: {} as any,
  operations: [
    {
      id: 'op-1',
      type: 'payment',
      to: 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJAU7RFHXL5IMTNQ3BM4XFBHQ',
      amount: '100.50',
      asset_code: 'XLM',
      _links: {} as any,
    } as any,
  ] as any,
} as unknown as Horizon.ServerApi.TransactionRecord;

const mockAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGQ5P5XG';
const mockNetwork = 'testnet' as any;

describe('useTransactionHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Fetching', () => {
    it('should fetch transactions on mount', async () => {
      const mockGetTransactions = jest.fn().mockResolvedValue([mockHorizonTransaction]);
      (horizonIndexer.getTransactions as jest.Mock) = mockGetTransactions;

      renderHook(() => useTransactionHistory(mockAddress, mockNetwork));

      await waitFor(() => {
        expect(mockGetTransactions).toHaveBeenCalledWith(mockAddress, mockNetwork, 200);
      });
    });

    it('should return empty array when address is null', () => {
      const { result } = renderHook(() => useTransactionHistory(null, mockNetwork));

      expect(result.current.transactions).toEqual([]);
      expect(result.current.pagination.totalCount).toBe(0);
    });

    it('should handle loading state', async () => {
      const mockGetTransactions = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
        );
      (horizonIndexer.getTransactions as jest.Mock) = mockGetTransactions;

      const { result } = renderHook(() => useTransactionHistory(mockAddress, mockNetwork));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle fetch errors', async () => {
      const mockError = new Error('Network error');
      (horizonIndexer.getTransactions as jest.Mock) = jest.fn().mockRejectedValue(mockError);

      const { result } = renderHook(() => useTransactionHistory(mockAddress, mockNetwork));

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
        expect(result.current.transactions).toEqual([]);
      });
    });

    it('should respect maxTransactions config', async () => {
      const mockGetTransactions = jest.fn().mockResolvedValue([mockHorizonTransaction]);
      (horizonIndexer.getTransactions as jest.Mock) = mockGetTransactions;

      const config = { maxTransactions: 100 };
      renderHook(() => useTransactionHistory(mockAddress, mockNetwork, config));

      await waitFor(() => {
        expect(mockGetTransactions).toHaveBeenCalledWith(mockAddress, mockNetwork, 100);
      });
    });
  });

  describe('Data Transformation', () => {
    it('should transform Horizon transaction to DisplayTransaction', async () => {
      (horizonIndexer.getTransactions as jest.Mock) = jest
        .fn()
        .mockResolvedValue([mockHorizonTransaction]);

      const { result } = renderHook(() => useTransactionHistory(mockAddress, mockNetwork));

      await waitFor(() => {
        expect(result.current.transactions).toHaveLength(1);
      });

      const tx = result.current.transactions[0];
      expect(tx.hash).toBe(mockHorizonTransaction.hash);
      expect(tx.type).toBe('payment');
      expect(tx.status).toBe('success');
      expect(tx.amount).toBe('100.50');
      expect(tx.assetCode).toBe('XLM');
      expect(tx.createdAt).toEqual(new Date('2024-01-15T10:30:00Z'));
    });

    it('should classify transaction type correctly', async () => {
      const txWithSwap = {
        ...mockHorizonTransaction,
        operations: [
          {
            type: 'swap',
            _links: {} as any,
          } as any,
        ] as any,
      } as unknown as Horizon.ServerApi.TransactionRecord;

      (horizonIndexer.getTransactions as jest.Mock) = jest.fn().mockResolvedValue([txWithSwap]);

      const { result } = renderHook(() => useTransactionHistory(mockAddress, mockNetwork));

      await waitFor(() => {
        expect(result.current.transactions[0].type).toBe('swap');
      });
    });

    it('should handle failed transactions', async () => {
      const failedTx = {
        ...mockHorizonTransaction,
        successful: false,
      } as unknown as Horizon.ServerApi.TransactionRecord;

      (horizonIndexer.getTransactions as jest.Mock) = jest.fn().mockResolvedValue([failedTx]);

      const { result } = renderHook(() => useTransactionHistory(mockAddress, mockNetwork));

      await waitFor(() => {
        expect(result.current.transactions[0].status).toBe('failed');
      });
    });
  });

  describe('Pagination', () => {
    it('should paginate transactions', async () => {
      const txArray = Array.from({ length: 25 }, (_, i) => ({
        ...mockHorizonTransaction,
        id: `tx-${i}`,
        hash: `hash-${i}`,
      })) as Horizon.ServerApi.TransactionRecord[];

      (horizonIndexer.getTransactions as jest.Mock) = jest.fn().mockResolvedValue(txArray);

      const config = { pageSize: 10 };
      const { result } = renderHook(() => useTransactionHistory(mockAddress, mockNetwork, config));

      await waitFor(() => {
        expect(result.current.transactions).toHaveLength(10); // First page
        expect(result.current.pagination.totalCount).toBe(25);
        expect(result.current.pagination.totalPages).toBe(3);
        expect(result.current.pagination.currentPage).toBe(1);
      });
    });

    it('should return correct pagination state', async () => {
      (horizonIndexer.getTransactions as jest.Mock) = jest
        .fn()
        .mockResolvedValue([mockHorizonTransaction]);

      const { result } = renderHook(() => useTransactionHistory(mockAddress, mockNetwork));

      await waitFor(() => {
        expect(result.current.pagination).toEqual({
          currentPage: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        });
      });
    });
  });

  describe('Caching', () => {
    it('should cache results and not refetch within TTL', async () => {
      const mockGetTransactions = jest.fn().mockResolvedValue([mockHorizonTransaction]);
      (horizonIndexer.getTransactions as jest.Mock) = mockGetTransactions;

      const config = { cacheTimeMs: 60000 };

      const { rerender } = renderHook(
        (props) => useTransactionHistory(props.address, mockNetwork, config),
        { initialProps: { address: mockAddress } }
      );

      await waitFor(() => {
        expect(mockGetTransactions).toHaveBeenCalledTimes(1);
      });

      // Re-render with same address
      rerender({ address: mockAddress });

      // Should not call getTransactions again (within cache TTL)
      expect(mockGetTransactions).toHaveBeenCalledTimes(1);
    });

    it('should refetch when cache expires', async () => {
      const mockGetTransactions = jest.fn().mockResolvedValue([mockHorizonTransaction]);
      (horizonIndexer.getTransactions as jest.Mock) = mockGetTransactions;

      const config = { cacheTimeMs: 0 }; // No cache

      renderHook(() => useTransactionHistory(mockAddress, mockNetwork, config));

      await waitFor(() => {
        expect(mockGetTransactions).toHaveBeenCalled();
      });
    });
  });

  describe('Auto-refresh', () => {
    it('should setup auto-refresh interval if configured', async () => {
      jest.useFakeTimers();

      const mockGetTransactions = jest.fn().mockResolvedValue([mockHorizonTransaction]);
      (horizonIndexer.getTransactions as jest.Mock) = mockGetTransactions;

      const config = { autoRefreshIntervalMs: 30000 };

      renderHook(() => useTransactionHistory(mockAddress, mockNetwork, config));

      await waitFor(() => {
        expect(mockGetTransactions).toHaveBeenCalled();
      });

      jest.advanceTimersByTime(30000);

      expect(mockGetTransactions).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should not setup auto-refresh if interval is 0', async () => {
      const mockGetTransactions = jest.fn().mockResolvedValue([mockHorizonTransaction]);
      (horizonIndexer.getTransactions as jest.Mock) = mockGetTransactions;

      const config = { autoRefreshIntervalMs: 0 };

      renderHook(() => useTransactionHistory(mockAddress, mockNetwork, config));

      await waitFor(() => {
        expect(mockGetTransactions).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Type Safety', () => {
    it('should return typed DisplayTransaction objects', async () => {
      (horizonIndexer.getTransactions as jest.Mock) = jest
        .fn()
        .mockResolvedValue([mockHorizonTransaction]);

      const { result } = renderHook(() => useTransactionHistory(mockAddress, mockNetwork));

      await waitFor(() => {
        const tx = result.current.transactions[0];

        // These should be typed and compile
        const id: string = tx.id;
        const hash: string = tx.hash;
        const date: Date = tx.createdAt;
        const status: 'success' | 'failed' = tx.status;

        expect(typeof id).toBe('string');
        expect(typeof hash).toBe('string');
        expect(date instanceof Date).toBe(true);
        expect(['success', 'failed']).toContain(status);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle transactions with missing operations', async () => {
      const txWithoutOps = {
        ...mockHorizonTransaction,
        operations: undefined,
      } as unknown as Horizon.ServerApi.TransactionRecord;

      (horizonIndexer.getTransactions as jest.Mock) = jest.fn().mockResolvedValue([txWithoutOps]);

      const { result } = renderHook(() => useTransactionHistory(mockAddress, mockNetwork));

      await waitFor(() => {
        expect(result.current.transactions[0].type).toBe('unknown');
      });
    });

    it('should handle empty operations array', async () => {
      const txWithEmptyOps = {
        ...mockHorizonTransaction,
        operations: [] as any,
      } as unknown as Horizon.ServerApi.TransactionRecord;

      (horizonIndexer.getTransactions as jest.Mock) = jest.fn().mockResolvedValue([txWithEmptyOps]);

      const { result } = renderHook(() => useTransactionHistory(mockAddress, mockNetwork));

      await waitFor(() => {
        expect(result.current.transactions[0].type).toBe('unknown');
      });
    });

    it('should handle memo field correctly', async () => {
      const txWithMemo = {
        ...mockHorizonTransaction,
        memo: 'Hello World',
      } as unknown as Horizon.ServerApi.TransactionRecord;

      (horizonIndexer.getTransactions as jest.Mock) = jest.fn().mockResolvedValue([txWithMemo]);

      const { result } = renderHook(() => useTransactionHistory(mockAddress, mockNetwork));

      await waitFor(() => {
        expect(result.current.transactions[0].memo).toBe('Hello World');
      });
    });
  });
});
