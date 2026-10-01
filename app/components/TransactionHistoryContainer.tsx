'use client';

/**
 * TransactionHistoryContainer Component
 *
 * Complete transaction history feature for Asset Details Page.
 * Combines transaction fetching, pagination, and display.
 *
 * Features:
 * - Responsive layout (mobile, tablet, desktop)
 * - Dark mode support
 * - Full WCAG AA accessibility
 * - Pagination with smart page navigation
 * - Loading and error states
 * - Transaction type classification
 */

import React, { useCallback, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useWrapStore } from '@/app/store/wrapStore';
import { useTransactionHistory } from '@/app/hooks/useTransactionHistory';
import { TransactionHistoryTable } from '@/app/components/TransactionHistoryTable';
import { Pagination } from '@/app/components/Pagination';
import type {
  DisplayTransaction,
  TransactionRowActions,
  TransactionHistoryConfig,
  TransactionTableColumn,
} from '@/app/types/transaction';
import { DEFAULT_TRANSACTION_HISTORY_CONFIG } from '@/app/types/transaction';

interface TransactionHistoryContainerProps {
  /**
   * Connected Stellar account address
   */
  address?: string | null;

  /**
   * Configuration for transaction history display
   */
  config?: Partial<TransactionHistoryConfig>;

  /**
   * Column visibility configuration
   */
  columns?: TransactionTableColumn[];

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Callback when a transaction is clicked
   */
  onTransactionClick?: (transaction: DisplayTransaction) => void;

  /**
   * Enable explorer links
   */
  enableExplorer?: boolean;

  /**
   * Explorer URL pattern (use {hash} for transaction hash)
   */
  explorerUrl?: string;
}

/**
 * Default explorer URL (Stellar testnet)
 */
const DEFAULT_EXPLORER_URL = 'https://stellar.expert/explorer/testnet/tx/{hash}';

/**
 * Error state component
 */
interface ErrorStateProps {
  error: string;
  onRetry: () => void;
  isLoading: boolean;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry, isLoading }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
    <div className="flex items-start gap-3">
      <AlertCircle
        size={20}
        className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400"
        aria-hidden="true"
      />
      <div className="flex-1">
        <h3 className="font-medium text-red-900 dark:text-red-200">Failed to load transactions</h3>
        <p className="mt-1 text-sm text-red-800 dark:text-red-300">{error}</p>
        <button
          onClick={onRetry}
          disabled={isLoading}
          className={clsx(
            'mt-3 inline-flex items-center gap-2 rounded-md px-3 py-2',
            'text-sm font-medium transition-colors duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'focus-visible:ring-[var(--color-theme-primary)]',
            isLoading
              ? 'cursor-not-allowed bg-red-200 text-red-700 opacity-50 dark:bg-red-800 dark:text-red-200'
              : 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
          )}
        >
          {isLoading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>Retrying...</span>
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              <span>Try again</span>
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

/**
 * Stats bar component
 */
interface StatsBarProps {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  lastRefreshAt?: Date;
}

const StatsBar: React.FC<StatsBarProps> = ({
  totalCount,
  currentPage,
  pageSize,
  lastRefreshAt,
}) => {
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800 sm:flex-row sm:items-center">
      <div className="text-xs text-gray-600 dark:text-gray-400">
        <span className="font-medium">
          Showing {startIndex} to {endIndex} of {totalCount} transactions
        </span>
        {lastRefreshAt && (
          <span className="ml-2 opacity-75">
            (Updated {formatRelativeTime(lastRefreshAt)})
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Format relative time (e.g., "5 minutes ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Main TransactionHistoryContainer Component
 */
export const TransactionHistoryContainer: React.FC<TransactionHistoryContainerProps> = ({
  address,
  config,
  columns = ['date', 'type', 'amount', 'counterparty', 'status', 'action'],
  className = '',
  onTransactionClick,
  enableExplorer = true,
  explorerUrl = DEFAULT_EXPLORER_URL,
}) => {
  const { network } = useWrapStore();
  const [currentPage, setCurrentPage] = useState(1);

  // Use provided address or fall back to store address
  const effectiveAddress = address;

  // Fetch transactions
  const {
    transactions,
    pagination,
    isLoading,
    error,
    lastRefreshAt,
  } = useTransactionHistory(effectiveAddress || null, network, config);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // Scroll to top of table for better UX
    const tableElement = document.querySelector('[aria-label="Transaction history"]');
    tableElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Handle retry for errors
  const handleRetry = useCallback(() => {
    // Force refresh by clearing cache
    // Note: This would require exposing a refresh function from the hook
    window.location.reload();
  }, []);

  // Row action handlers
  const rowActions: TransactionRowActions = {
    onViewDetails: onTransactionClick,
    onViewOnExplorer: enableExplorer
      ? (tx) => {
          const url = explorerUrl.replace('{hash}', tx.hash);
          window.open(url, '_blank');
        }
      : undefined,
    onCopyHash: () => {
      // Show a toast notification here if available
      console.log('Transaction hash copied');
    },
  };

  // Show loading state
  if (isLoading && !transactions.length) {
    return (
      <div className={clsx('space-y-4', className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 w-full rounded bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show address required message
  if (!effectiveAddress) {
    return (
      <div className={clsx('rounded-lg bg-blue-50 p-4 dark:bg-blue-900/30', className)}>
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Connect your Stellar wallet to view transaction history.
        </p>
      </div>
    );
  }

  // Show error state
  if (error && !transactions.length) {
    return (
      <div className={clsx('space-y-4', className)}>
        <ErrorState error={error} onRetry={handleRetry} isLoading={isLoading} />
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Header Section */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Transaction History
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Last 20 transactions from your account
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      {transactions.length > 0 && (
        <StatsBar
          totalCount={pagination.totalCount}
          currentPage={currentPage}
          pageSize={pagination.pageSize}
          lastRefreshAt={lastRefreshAt}
        />
      )}

      {/* Table */}
      <TransactionHistoryTable
        transactions={transactions}
        isLoading={isLoading}
        columns={columns}
        actions={rowActions}
        onRowClick={onTransactionClick}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          isLoading={isLoading}
        />
      )}

      {/* Empty State with Tip */}
      {transactions.length === 0 && !isLoading && !error && (
        <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/30">
          <h3 className="font-medium text-amber-900 dark:text-amber-200">No transactions yet</h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            Start making transactions on the Stellar network to see them appear here.
          </p>
        </div>
      )}

      {/* Error Message (with results) */}
      {error && transactions.length > 0 && (
        <div className="rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          ⚠️ Note: There was an issue fetching all transactions. Showing cached results.
        </div>
      )}
    </div>
  );
};

export default TransactionHistoryContainer;
