/**
 * Unit tests for TransactionHistoryTable component
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionHistoryTable } from './TransactionHistoryTable';
import type { DisplayTransaction } from '@/app/types/transaction';

// Mock data
const mockTransaction: DisplayTransaction = {
  id: '123456',
  hash: 'abc123def456',
  createdAt: new Date('2024-01-15T10:30:00Z'),
  type: 'payment',
  status: 'success',
  amount: '100.50',
  assetCode: 'XLM',
  counterparty: 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJAU7RFHXL5IMTNQ3BM4XFBHQ',
  fee: '0.00001',
  memo: 'Test payment',
  ledgerSequence: 12345,
  operationCount: 1,
  source: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGQ5P5XG',
};

describe('TransactionHistoryTable', () => {
  describe('Rendering', () => {
    it('should render table with transactions', () => {
      const { container } = render(
        <TransactionHistoryTable
          transactions={[mockTransaction]}
          isLoading={false}
        />
      );

      expect(screen.getByRole('grid', { name: /transaction history/i })).toBeInTheDocument();
      expect(screen.getByText('payment', { selector: 'span' })).toBeInTheDocument();
      expect(screen.getByText(/100.50/)).toBeInTheDocument();
    });

    it('should show loading skeletons when isLoading is true', () => {
      render(
        <TransactionHistoryTable
          transactions={[]}
          isLoading={true}
        />
      );

      const skeletons = screen.getAllByRole('row');
      expect(skeletons.length).toBeGreaterThan(1); // Header + skeleton rows
    });

    it('should show empty state when no transactions', () => {
      render(
        <TransactionHistoryTable
          transactions={[]}
          isLoading={false}
        />
      );

      expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(
        <TransactionHistoryTable
          transactions={[mockTransaction]}
          isLoading={false}
        />
      );

      const table = screen.getByRole('grid', { name: /transaction history/i });
      expect(table.querySelector('thead')).toBeInTheDocument();
      expect(table.querySelector('tbody')).toBeInTheDocument();
    });

    it('should have accessible column headers', () => {
      render(
        <TransactionHistoryTable
          transactions={[mockTransaction]}
          isLoading={false}
        />
      );

      expect(screen.getByRole('columnheader', { name: /date & time/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /type/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /amount/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    });

    it('should have proper time element for dates', () => {
      render(
        <TransactionHistoryTable
          transactions={[mockTransaction]}
          isLoading={false}
        />
      );

      const timeElement = screen.getByRole('gridcell', { name: /Jan/i })?.closest('time');
      expect(timeElement).toHaveAttribute('datetime');
    });

    it('should have accessible status indicators', () => {
      const successTx = { ...mockTransaction, status: 'success' as const };
      const failedTx = { ...mockTransaction, id: '789', status: 'failed' as const };

      render(
        <TransactionHistoryTable
          transactions={[successTx, failedTx]}
          isLoading={false}
        />
      );

      expect(screen.getAllByText('Success')).toHaveLength(1);
      expect(screen.getAllByText('Failed')).toHaveLength(1);
    });
  });

  describe('Interactions', () => {
    it('should call onRowClick when row is clicked', async () => {
      const handleRowClick = jest.fn();
      const user = userEvent.setup();

      render(
        <TransactionHistoryTable
          transactions={[mockTransaction]}
          isLoading={false}
          onRowClick={handleRowClick}
        />
      );

      const row = screen.getAllByRole('row')[1]; // Skip header
      await user.click(row);

      expect(handleRowClick).toHaveBeenCalledWith(mockTransaction);
    });

    it('should copy transaction hash when copy button is clicked', async () => {
      const user = userEvent.setup();
      const mockClipboard = jest.fn();
      Object.assign(navigator, {
        clipboard: {
          writeText: mockClipboard,
        },
      });

      render(
        <TransactionHistoryTable
          transactions={[mockTransaction]}
          isLoading={false}
        />
      );

      const copyButton = screen.getByRole('button', { name: /copy hash/i });
      await user.click(copyButton);

      expect(mockClipboard).toHaveBeenCalledWith(mockTransaction.hash);
    });

    it('should call onViewOnExplorer when explorer button is clicked', async () => {
      const handleExplorer = jest.fn();
      const user = userEvent.setup();
      const windowSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <TransactionHistoryTable
          transactions={[mockTransaction]}
          isLoading={false}
          actions={{ onViewOnExplorer: handleExplorer }}
        />
      );

      const explorerButton = screen.getByRole('button', { name: /view on explorer/i });
      await user.click(explorerButton);

      expect(handleExplorer).toHaveBeenCalledWith(mockTransaction);
      windowSpy.mockRestore();
    });
  });

  describe('Responsive Design', () => {
    it('should truncate long addresses', () => {
      const longAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGQ5P5XG';
      const txWithLongCounterparty = {
        ...mockTransaction,
        counterparty: longAddress,
      };

      render(
        <TransactionHistoryTable
          transactions={[txWithLongCounterparty]}
          isLoading={false}
        />
      );

      // Address should be truncated with ellipsis
      const displayedAddress = screen.getByText(/\.\.\./);
      expect(displayedAddress).toBeInTheDocument();
      expect(displayedAddress.textContent?.length).toBeLessThan(longAddress.length);
    });

    it('should handle multiple transactions', () => {
      const transactions = Array.from({ length: 10 }, (_, i) => ({
        ...mockTransaction,
        id: `tx-${i}`,
        hash: `hash-${i}`,
      }));

      render(
        <TransactionHistoryTable
          transactions={transactions}
          isLoading={false}
        />
      );

      expect(screen.getAllByRole('row')).toHaveLength(11); // Header + 10 rows
    });
  });

  describe('Type Safety', () => {
    it('should accept all valid transaction types', () => {
      const types = [
        'payment',
        'swap',
        'manage_buy_offer',
        'create_account',
        'account_merge',
      ] as const;

      types.forEach((type) => {
        const tx = { ...mockTransaction, type };
        const { unmount } = render(
          <TransactionHistoryTable
            transactions={[tx]}
            isLoading={false}
          />
        );
        unmount();
      });
    });

    it('should handle optional fields gracefully', () => {
      const minimalTx = {
        ...mockTransaction,
        amount: undefined,
        assetCode: undefined,
        counterparty: undefined,
        memo: undefined,
      };

      render(
        <TransactionHistoryTable
          transactions={[minimalTx]}
          isLoading={false}
        />
      );

      // Should render without errors
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });
  });

  describe('Dark Mode', () => {
    it('should apply dark mode classes', () => {
      const { container } = render(
        <TransactionHistoryTable
          transactions={[mockTransaction]}
          isLoading={false}
        />
      );

      const table = container.querySelector('[aria-label="Transaction history"]');
      expect(table?.parentElement).toHaveClass('dark:border-gray-700');
    });
  });

  describe('Column Configuration', () => {
    it('should support custom column configuration', () => {
      render(
        <TransactionHistoryTable
          transactions={[mockTransaction]}
          isLoading={false}
          columns={['date', 'type', 'status']}
        />
      );

      expect(screen.getByRole('columnheader', { name: /date/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /type/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
    });
  });
});
