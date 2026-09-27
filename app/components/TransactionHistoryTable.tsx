'use client';

/**
 * TransactionHistoryTable Component
 *
 * Displays transaction history in a paginated, responsive table with
 * virtualization for large lists. Implements WCAG AA accessibility
 * standards with proper ARIA labels, semantic HTML, and full keyboard
 * navigation support.
 */

import React, { useMemo, useRef, forwardRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import clsx from 'clsx';
import { ExternalLink, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import type { DisplayTransaction, TransactionRowActions, TransactionTableColumn } from '@/app/types/transaction';

interface TransactionHistoryTableProps {
  transactions: DisplayTransaction[];
  isLoading: boolean;
  columns?: TransactionTableColumn[];
  actions?: TransactionRowActions;
  onRowClick?: (transaction: DisplayTransaction) => void;
  className?: string;
  enableHighlight?: boolean;
}

/**
 * Formats a date for display
 */
function formatDate(date: Date): string {
  return format(date, 'MMM d, yyyy HH:mm:ss');
}

/**
 * Formats a transaction type for display
 */
function formatTransactionType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formats amount with proper decimal places
 */
function formatAmount(amount: string | undefined): string {
  if (!amount) return '—';
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(num);
}

/**
 * Truncates a string with ellipsis
 */
function truncateString(str: string, maxLength: number = 10): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Loading skeleton row
 */
const SkeletonRow: React.FC = () => (
  <tr className="border-b border-gray-200 dark:border-gray-700">
    {Array.from({ length: 6 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 w-full animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
      </td>
    ))}
  </tr>
);

/**
 * Empty state message
 */
const EmptyState: React.FC = () => (
  <tr>
    <td colSpan={6} className="px-4 py-12 text-center">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p className="mb-1 text-base font-medium">No transactions found</p>
        <p>Your transaction history will appear here</p>
      </div>
    </td>
  </tr>
);

interface TransactionRowProps {
  transaction: DisplayTransaction;
  actions?: TransactionRowActions;
  onRowClick?: (transaction: DisplayTransaction) => void;
  showMemo: boolean;
  showFee: boolean;
  style?: React.CSSProperties;
}

/**
 * Individual transaction row — uses forwardRef so the virtualizer
 * can measure each row's actual rendered height.
 */
const TransactionRow = forwardRef<HTMLTableRowElement, TransactionRowProps>(
  (
    { transaction, actions, onRowClick, showMemo, showFee, style },
    ref
  ) => {
    const [copiedHash, setCopiedHash] = React.useState(false);

    const handleCopyHash = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(transaction.hash);
        setCopiedHash(true);
        setTimeout(() => setCopiedHash(false), 2000);
        actions?.onCopyHash?.(transaction);
      },
      [transaction, actions]
    );

    const handleViewExplorer = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        actions?.onViewOnExplorer?.(transaction);
      },
      [transaction, actions]
    );

    const handleRowClick = React.useCallback(() => {
      onRowClick?.(transaction);
      actions?.onViewDetails?.(transaction);
    }, [transaction, onRowClick, actions]);

    return (
      <tr
        ref={ref}
        style={style}
        onClick={handleRowClick}
        className={clsx(
          'border-b border-gray-200 transition-colors duration-150',
          'dark:border-gray-700',
          onRowClick || actions?.onViewDetails
            ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
            : ''
        )}
      >
        {/* Date */}
        <td className="whitespace-nowrap px-4 py-3">
          <time dateTime={transaction.createdAt.toISOString()} className="text-sm">
            {formatDate(transaction.createdAt)}
          </time>
        </td>

        {/* Type */}
        <td className="px-4 py-3">
          <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {formatTransactionType(transaction.type)}
          </span>
        </td>

        {/* Amount */}
        <td className="px-4 py-3 text-right">
          <span className="font-medium text-gray-900 dark:text-white">
            {formatAmount(transaction.amount)}
          </span>
          {transaction.assetCode && (
            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
              {transaction.assetCode}
            </span>
          )}
        </td>

        {/* Counterparty */}
        <td className="px-4 py-3">
          {transaction.counterparty ? (
            <span
              className="text-xs text-gray-600 dark:text-gray-400"
              title={transaction.counterparty}
            >
              {truncateString(transaction.counterparty, 16)}
            </span>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
          )}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {transaction.status === 'success' ? (
              <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
            )}
            <span
              className={clsx(
                'text-xs font-medium',
                transaction.status === 'success'
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              )}
            >
              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
            </span>
          </div>
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Copy Hash Button */}
            <button
              onClick={handleCopyHash}
              title={copiedHash ? 'Copied!' : 'Copy transaction hash'}
              aria-label={`Copy hash for transaction ${transaction.hash}`}
              className={clsx(
                'inline-flex items-center justify-center rounded p-1.5',
                'transition-colors duration-150',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'focus-visible:ring-[var(--color-theme-primary)]'
              )}
            >
              <Copy
                size={14}
                className={clsx(
                  'transition-colors duration-200',
                  copiedHash ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                )}
              />
            </button>

            {/* View on Explorer Button */}
            {actions?.onViewOnExplorer && (
              <button
                onClick={handleViewExplorer}
                title="View on blockchain explorer"
                aria-label={`View transaction ${transaction.hash} on explorer`}
                className={clsx(
                  'inline-flex items-center justify-center rounded p-1.5',
                  'transition-colors duration-150',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  'focus-visible:ring-[var(--color-theme-primary)]'
                )}
              >
                <ExternalLink size={14} className="text-gray-600 dark:text-gray-400" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }
);

TransactionRow.displayName = 'TransactionRow';

/**
 * TransactionHistoryTable Component
 *
 * Uses @tanstack/react-virtual to render only visible rows, preventing
 * the main thread from blocking when rendering thousands of transactions.
 */
export const TransactionHistoryTable: React.FC<TransactionHistoryTableProps> = ({
  transactions,
  isLoading,
  columns = ['date', 'type', 'amount', 'counterparty', 'status', 'action'],
  actions,
  onRowClick,
  className = '',
  enableHighlight = true,
}) => {
  const tableColumns = useMemo(
    () => ({
      date: 'Date & Time',
      type: 'Type',
      amount: 'Amount',
      counterparty: 'Counterparty',
      status: 'Status',
      fee: 'Fee',
      memo: 'Memo',
      action: 'Actions',
    }),
    []
  );

  // Filter columns based on requested columns
  const visibleColumns = useMemo(
    () => columns.filter((col) => col in tableColumns),
    [columns]
  );

  const showMemo = visibleColumns.includes('memo');
  const showFee = visibleColumns.includes('fee');

  // Virtualizer for the table rows — only renders rows visible in the viewport
  const containerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 52,
    overscan: 5,
  });

  // Show loading skeletons when loading and no data
  if (isLoading && transactions.length === 0) {
    return (
      <div className={clsx('w-full overflow-x-auto', className)}>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          <table role="grid" className="w-full border-collapse text-sm" aria-label="Transaction history">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">{tableColumns.date}</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">{tableColumns.type}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{tableColumns.amount}</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">{tableColumns.counterparty}</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">{tableColumns.status}</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">{tableColumns.action}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={`skeleton-${i}`} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Show empty state
  if (transactions.length === 0) {
    return (
      <div className={clsx('w-full overflow-x-auto', className)}>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          <table role="grid" className="w-full border-collapse text-sm" aria-label="Transaction history">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">{tableColumns.date}</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">{tableColumns.type}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{tableColumns.amount}</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">{tableColumns.counterparty}</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">{tableColumns.status}</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">{tableColumns.action}</th>
              </tr>
            </thead>
            <tbody>
              <EmptyState />
            </tbody>
          </table>
        </div>
        {!isLoading && (
          <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <p className="font-medium">💡 Tip:</p>
            <p>Make some transactions on the Stellar network to see them here.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={clsx('w-full overflow-x-auto overflow-y-auto', className)}
      style={{ maxHeight: '600px' }}
    >
      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Table */}
        <table
          role="grid"
          className="w-full border-collapse text-sm"
          aria-label="Transaction history"
        >
          {/* Header */}
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
            <tr>
              <th
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-900 dark:text-white"
              >
                {tableColumns.date}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white"
              >
                {tableColumns.type}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white"
              >
                {tableColumns.amount}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white"
              >
                {tableColumns.counterparty}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white"
              >
                {tableColumns.status}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white"
              >
                {tableColumns.action}
              </th>
            </tr>
          </thead>

          {/* Body — virtualized */}
          <tbody style={{ display: 'block', height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const transaction = transactions[virtualRow.index];
              return (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  actions={actions}
                  onRowClick={onRowClick}
                  showMemo={showMemo}
                  showFee={showFee}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  ref={rowVirtualizer.measureElement}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* No Results Message */}
      {!isLoading && transactions.length === 0 && (
        <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          <p className="font-medium">💡 Tip:</p>
          <p>Make some transactions on the Stellar network to see them here.</p>
        </div>
      )}
    </div>
  );
};

export default TransactionHistoryTable;
