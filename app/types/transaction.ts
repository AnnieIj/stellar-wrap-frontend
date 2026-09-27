/**
 * Transaction-related type definitions for Asset Details page
 */

import type { Horizon } from 'stellar-sdk';

/**
 * Extended transaction record with computed display properties
 */
export interface DisplayTransaction {
  id: string;
  hash: string;
  createdAt: Date;
  type: TransactionType;
  status: TransactionStatus;
  amount?: string;
  assetCode?: string;
  counterparty?: string;
  fee: string;
  memo?: string;
  ledgerSequence: number;
  operationCount: number;
  source?: string;
}

/**
 * Classification of transaction type based on Horizon operation
 */
export type TransactionType =
  | 'payment'
  | 'path_payment'
  | 'manage_buy_offer'
  | 'manage_sell_offer'
  | 'create_account'
  | 'account_merge'
  | 'manage_data'
  | 'bump_sequence'
  | 'liquidity_pool_deposit'
  | 'liquidity_pool_withdraw'
  | 'swap'
  | 'invoke_host_function'
  | 'extend_footprint_ttl'
  | 'restore_footprint'
  | 'unknown';

/**
 * Transaction status
 */
export type TransactionStatus = 'success' | 'failed';

/**
 * Pagination state
 */
export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * Transaction history fetch result
 */
export interface TransactionHistoryResult {
  transactions: DisplayTransaction[];
  pagination: PaginationState;
  isLoading: boolean;
  error: string | null;
  lastRefreshAt?: Date;
}

/**
 * Raw Horizon transaction response
 */
export type HorizonTransactionRecord = Horizon.ServerApi.TransactionRecord;

/**
 * Filter options for transaction queries
 */
export interface TransactionFilterOptions {
  type?: TransactionType;
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Configuration for transaction history component
 */
export interface TransactionHistoryConfig {
  pageSize: number;
  maxTransactions: number;
  autoRefreshIntervalMs?: number;
  cacheTimeMs?: number;
  showMemo: boolean;
  showFee: boolean;
  enableExport: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_TRANSACTION_HISTORY_CONFIG: TransactionHistoryConfig = {
  pageSize: 10,
  maxTransactions: 200, // Limited to 200 per Horizon's limit
  autoRefreshIntervalMs: 0, // Disabled by default
  cacheTimeMs: 5 * 60 * 1000, // 5 minutes
  showMemo: true,
  showFee: false,
  enableExport: false,
};

/**
 * Column definitions for the transaction table
 */
export type TransactionTableColumn =
  | 'date'
  | 'type'
  | 'amount'
  | 'asset'
  | 'counterparty'
  | 'status'
  | 'fee'
  | 'memo'
  | 'action';

/**
 * Error types for transaction fetching
 */
export type TransactionFetchError = 'network' | 'unauthorized' | 'notfound' | 'timeout' | 'unknown';

/**
 * Row action handlers
 */
export interface TransactionRowActions {
  onViewDetails?: (transaction: DisplayTransaction) => void;
  onViewOnExplorer?: (transaction: DisplayTransaction) => void;
  onCopyHash?: (transaction: DisplayTransaction) => void;
}
