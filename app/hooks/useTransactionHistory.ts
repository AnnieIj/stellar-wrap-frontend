'use client';

/**
 * Hook for fetching and managing transaction history
 * Handles data fetching from Horizon API, caching, and pagination
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Horizon } from 'stellar-sdk';
import { horizonIndexer } from '@/src/services/horizonIndexer';
import { Network } from '@/src/config';
import type {
  DisplayTransaction,
  HorizonTransactionRecord,
  PaginationState,
  TransactionHistoryResult,
  TransactionHistoryConfig,
  TransactionFetchError,
  TransactionStatus,
  TransactionType,
} from '@/app/types/transaction';
import { DEFAULT_TRANSACTION_HISTORY_CONFIG } from '@/app/types/transaction';

/**
 * Classifies a Horizon transaction by examining its operations
 */
function classifyTransactionType(tx: HorizonTransactionRecord): TransactionType {
  if (!tx.operations || tx.operations.length === 0) {
    return 'unknown';
  }

  const firstOp = tx.operations[0];

  // Map operation types to transaction types
  const typeMap: Record<string, TransactionType> = {
    payment: 'payment',
    path_payment_strict_send: 'path_payment',
    path_payment_strict_receive: 'path_payment',
    manage_buy_offer: 'manage_buy_offer',
    manage_sell_offer: 'manage_sell_offer',
    create_account: 'create_account',
    account_merge: 'account_merge',
    manage_data: 'manage_data',
    bump_sequence: 'bump_sequence',
    liquidity_pool_deposit: 'liquidity_pool_deposit',
    liquidity_pool_withdraw: 'liquidity_pool_withdraw',
    swap: 'swap',
    invoke_host_function: 'invoke_host_function',
    extend_footprint_ttl: 'extend_footprint_ttl',
    restore_footprint: 'restore_footprint',
  };

  return typeMap[firstOp.type] || 'unknown';
}

/**
 * Determines if an operation involves a specific account
 */
function getCounterparty(
  operation: Record<string, unknown>,
  userAddress: string
): string | undefined {
  const to = (operation.to || operation.account) as string | undefined;
  const from = (operation.from) as string | undefined;

  if (to && to !== userAddress) return to;
  if (from && from !== userAddress) return from;

  return undefined;
}

/**
 * Extracts amount from operation
 */
function getOperationAmount(operation: Record<string, unknown>): string | undefined {
  const amount = operation.amount as string | undefined;
  const buyingAmount = operation.buying_amount as string | undefined;
  const sellingAmount = operation.selling_amount as string | undefined;

  return amount || buyingAmount || sellingAmount;
}

/**
 * Extracts asset code from operation
 */
function getOperationAssetCode(operation: Record<string, unknown>): string | undefined {
  const asset = operation.asset as string | undefined;
  const assetCode = operation.asset_code as string | undefined;
  const buyingAsset = operation.buying_asset_code as string | undefined;
  const sellingAsset = operation.selling_asset_code as string | undefined;

  return asset || assetCode || buyingAsset || sellingAsset;
}

/**
 * Converts a Horizon transaction to DisplayTransaction
 */
function transformTransaction(
  tx: HorizonTransactionRecord,
  userAddress: string
): DisplayTransaction {
  const operations = (tx.operations || []) as Record<string, unknown>[];
  const firstOp = operations[0];

  let amount: string | undefined;
  let assetCode: string | undefined;
  let counterparty: string | undefined;

  if (firstOp) {
    amount = getOperationAmount(firstOp);
    assetCode = getOperationAssetCode(firstOp);
    counterparty = getCounterparty(firstOp, userAddress);
  }

  const status: TransactionStatus = (tx.successful !== false) ? 'success' : 'failed';

  return {
    id: tx.id,
    hash: tx.hash,
    createdAt: new Date(tx.created_at),
    type: classifyTransactionType(tx),
    status,
    amount,
    assetCode,
    counterparty,
    fee: tx.fee_charged ? `${parseInt(tx.fee_charged) / 10000000}` : '0',
    memo: tx.memo || undefined,
    ledgerSequence: tx.ledger_sequence,
    operationCount: tx.operation_count || 1,
    source: tx.source_account,
  };
}

/**
 * useTransactionHistory Hook
 *
 * Manages fetching and paginating transaction history from Horizon API
 */
export function useTransactionHistory(
  address: string | null,
  network: Network,
  config: Partial<TransactionHistoryConfig> = {}
): TransactionHistoryResult {
  const fullConfig: TransactionHistoryConfig = {
    ...DEFAULT_TRANSACTION_HISTORY_CONFIG,
    ...config,
  };

  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date>();

  const cacheRef = useRef<{
    data: HorizonTransactionRecord[];
    timestamp: number;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetches transactions from Horizon API with caching
   */
  const fetchTransactions = useCallback(async () => {
    if (!address) {
      setTransactions([]);
      setTotalCount(0);
      setError(null);
      return;
    }

    // Check if we have fresh cached data
    if (cacheRef.current) {
      const cacheAge = Date.now() - cacheRef.current.timestamp;
      if (cacheAge < fullConfig.cacheTimeMs) {
        setTransactions(
          cacheRef.current.data
            .slice(0, fullConfig.maxTransactions)
            .map((tx) => transformTransaction(tx, address))
        );
        setTotalCount(cacheRef.current.data.length);
        setError(null);
        return;
      }
    }

    // Abort previous request if still in flight
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const horizonTxs = await horizonIndexer.getTransactions(
        address,
        network,
        fullConfig.maxTransactions
      );

      // Cache the raw data
      cacheRef.current = {
        data: horizonTxs,
        timestamp: Date.now(),
      };

      const displayTxs = horizonTxs.map((tx) => transformTransaction(tx, address));
      setTransactions(displayTxs);
      setTotalCount(displayTxs.length);
      setCurrentPage(1);
      setLastRefreshAt(new Date());
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch transactions';
      setError(errorMessage);
      setTransactions([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [address, network, fullConfig]);

  /**
   * Initial fetch and auto-refresh setup
   */
  useEffect(() => {
    fetchTransactions();

    // Setup auto-refresh if configured
    let intervalId: NodeJS.Timeout | undefined;
    if (fullConfig.autoRefreshIntervalMs > 0) {
      intervalId = setInterval(() => {
        fetchTransactions();
      }, fullConfig.autoRefreshIntervalMs);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      abortControllerRef.current?.abort();
    };
  }, [fetchTransactions, fullConfig.autoRefreshIntervalMs]);

  /**
   * Calculate pagination
   */
  const startIndex = (currentPage - 1) * fullConfig.pageSize;
  const endIndex = startIndex + fullConfig.pageSize;
  const paginatedTransactions = transactions.slice(startIndex, endIndex);
  const totalPages = Math.ceil(totalCount / fullConfig.pageSize);

  const pagination: PaginationState = {
    currentPage,
    pageSize: fullConfig.pageSize,
    totalCount,
    totalPages,
  };

  return {
    transactions: paginatedTransactions,
    pagination,
    isLoading,
    error,
    lastRefreshAt,
  };
}

/**
 * Hook to change the current page
 */
export function usePagination(initialPage = 1, pageSize = 10) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const goToPage = useCallback((page: number, totalPages: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  }, []);

  const nextPage = useCallback(
    (totalPages: number) => goToPage(currentPage + 1, totalPages),
    [currentPage, goToPage]
  );

  const prevPage = useCallback(
    (totalPages: number) => goToPage(currentPage - 1, totalPages),
    [currentPage, goToPage]
  );

  const resetPagination = useCallback(() => setCurrentPage(1), []);

  return {
    currentPage,
    goToPage,
    nextPage,
    prevPage,
    resetPagination,
  };
}
