/**
 * Storybook stories for Transaction History components
 *
 * Showcase component in different states and configurations
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TransactionHistoryTable } from './TransactionHistoryTable';
import { Pagination } from './Pagination';
import type { DisplayTransaction } from '@/app/types/transaction';

// Mock transaction data
const mockTransactions: DisplayTransaction[] = [
  {
    id: '1',
    hash: 'abc123def456789abc123def456789abc12',
    createdAt: new Date('2024-01-15T10:30:00Z'),
    type: 'payment',
    status: 'success',
    amount: '100.50',
    assetCode: 'XLM',
    counterparty: 'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJAU7RFHXL5IMTNQ3BM4XFBHQ',
    fee: '0.00001',
    memo: 'Transfer to friend',
    ledgerSequence: 12345,
    operationCount: 1,
  },
  {
    id: '2',
    hash: 'def456789abc123def456789abc123def45',
    createdAt: new Date('2024-01-14T15:45:30Z'),
    type: 'swap',
    status: 'success',
    amount: '250.75',
    assetCode: 'USDC',
    counterparty: 'GBUQWP3BOUZX34ULNQG23RQ6F5LZXAYNIHVHI5ELJSUCVYJVZFVCSEPO',
    fee: '0.00002',
    memo: undefined,
    ledgerSequence: 12340,
    operationCount: 1,
  },
  {
    id: '3',
    hash: '789abc123def456789abc123def456789ab',
    createdAt: new Date('2024-01-13T08:15:00Z'),
    type: 'manage_sell_offer',
    status: 'success',
    amount: '1000',
    assetCode: 'EUR',
    counterparty: undefined,
    fee: '0.00001',
    memo: 'Selling EUR',
    ledgerSequence: 12335,
    operationCount: 1,
  },
  {
    id: '4',
    hash: 'abc123def456789abc123def456789abc45',
    createdAt: new Date('2024-01-12T20:00:00Z'),
    type: 'create_account',
    status: 'failed',
    amount: undefined,
    assetCode: undefined,
    counterparty: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGQ5P5XG',
    fee: '0.00001',
    memo: 'Account creation failed',
    ledgerSequence: 12330,
    operationCount: 1,
  },
  {
    id: '5',
    hash: '456789abc123def456789abc123def456789',
    createdAt: new Date('2024-01-11T12:30:45Z'),
    type: 'liquidity_pool_deposit',
    status: 'success',
    amount: '5000.25',
    assetCode: 'XLM',
    counterparty: undefined,
    fee: '0.00001',
    memo: 'LP deposit',
    ledgerSequence: 12325,
    operationCount: 2,
  },
];

// ============================================================================
// TransactionHistoryTable Stories
// ============================================================================

const TransactionTableMeta: Meta<typeof TransactionHistoryTable> = {
  title: 'Transaction History/Table',
  component: TransactionHistoryTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A responsive, accessible table component for displaying Stellar transaction history.',
      },
    },
  },
  tags: ['autodocs'],
};

export default TransactionTableMeta;

type TransactionTableStory = StoryObj<typeof TransactionHistoryTable>;

/**
 * Default table with transactions
 */
export const Default: TransactionTableStory = {
  args: {
    transactions: mockTransactions,
    isLoading: false,
  },
};

/**
 * Loading state
 */
export const Loading: TransactionTableStory = {
  args: {
    transactions: [],
    isLoading: true,
  },
};

/**
 * Empty state
 */
export const Empty: TransactionTableStory = {
  args: {
    transactions: [],
    isLoading: false,
  },
};

/**
 * Single transaction
 */
export const SingleTransaction: TransactionTableStory = {
  args: {
    transactions: [mockTransactions[0]],
    isLoading: false,
  },
};

/**
 * With failed transaction
 */
export const WithFailedTransaction: TransactionTableStory = {
  args: {
    transactions: [mockTransactions[3]],
    isLoading: false,
  },
};

/**
 * With custom column configuration
 */
export const CustomColumns: TransactionTableStory = {
  args: {
    transactions: mockTransactions,
    isLoading: false,
    columns: ['date', 'type', 'amount', 'status', 'action'],
  },
};

/**
 * With row click handler
 */
export const WithRowClickHandler: TransactionTableStory = {
  args: {
    transactions: mockTransactions,
    isLoading: false,
    onRowClick: (tx) => {
      console.log('Clicked transaction:', tx);
      alert(`Clicked transaction: ${tx.hash}`);
    },
  },
};

/**
 * With action handlers
 */
export const WithActionHandlers: TransactionTableStory = {
  args: {
    transactions: mockTransactions,
    isLoading: false,
    actions: {
      onViewDetails: (tx) => alert(`View details: ${tx.hash}`),
      onViewOnExplorer: (tx) => {
        console.log(`Open explorer for: ${tx.hash}`);
        alert(`Would open explorer: https://stellar.expert/explorer/testnet/tx/${tx.hash}`);
      },
      onCopyHash: (tx) => {
        console.log(`Copied: ${tx.hash}`);
        alert(`Copied: ${tx.hash}`);
      },
    },
  },
};

/**
 * Dark mode
 */
export const DarkMode: TransactionTableStory = {
  args: {
    transactions: mockTransactions,
    isLoading: false,
  },
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#191414' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <div className="bg-[#191414] p-4">
          <Story />
        </div>
      </div>
    ),
  ],
};

// ============================================================================
// Pagination Stories
// ============================================================================

const PaginationMeta: Meta<typeof Pagination> = {
  title: 'Transaction History/Pagination',
  component: Pagination,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Accessible pagination controls with keyboard navigation support.',
      },
    },
  },
  tags: ['autodocs'],
};

export const PaginationStories = PaginationMeta;

type PaginationStory = StoryObj<typeof Pagination>;

/**
 * First page
 */
export const PaginationFirstPage: PaginationStory = {
  args: {
    currentPage: 1,
    totalPages: 5,
    onPageChange: (page) => console.log(`Go to page ${page}`),
  },
};

/**
 * Middle page
 */
export const PaginationMiddlePage: PaginationStory = {
  args: {
    currentPage: 3,
    totalPages: 5,
    onPageChange: (page) => console.log(`Go to page ${page}`),
  },
};

/**
 * Last page
 */
export const PaginationLastPage: PaginationStory = {
  args: {
    currentPage: 5,
    totalPages: 5,
    onPageChange: (page) => console.log(`Go to page ${page}`),
  },
};

/**
 * Loading state
 */
export const PaginationLoading: PaginationStory = {
  args: {
    currentPage: 2,
    totalPages: 5,
    onPageChange: (page) => console.log(`Go to page ${page}`),
    isLoading: true,
  },
};

/**
 * Many pages
 */
export const PaginationManyPages: PaginationStory = {
  args: {
    currentPage: 10,
    totalPages: 100,
    onPageChange: (page) => console.log(`Go to page ${page}`),
    maxPageButtons: 7,
  },
};

/**
 * Single page
 */
export const PaginationSinglePage: PaginationStory = {
  args: {
    currentPage: 1,
    totalPages: 1,
    onPageChange: (page) => console.log(`Go to page ${page}`),
  },
};

/**
 * No page numbers
 */
export const PaginationNoPageNumbers: PaginationStory = {
  args: {
    currentPage: 3,
    totalPages: 5,
    onPageChange: (page) => console.log(`Go to page ${page}`),
    showPageNumbers: false,
  },
};

/**
 * Dark mode
 */
export const PaginationDarkMode: PaginationStory = {
  args: {
    currentPage: 2,
    totalPages: 5,
    onPageChange: (page) => console.log(`Go to page ${page}`),
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <div className="bg-[#191414] p-4">
          <Story />
        </div>
      </div>
    ),
  ],
};

/**
 * With custom aria label
 */
export const PaginationCustomLabel: PaginationStory = {
  args: {
    currentPage: 2,
    totalPages: 5,
    onPageChange: (page) => console.log(`Go to page ${page}`),
    ariaLabel: 'Navigate through search results',
  },
};

// ============================================================================
// Responsive Preview Stories
// ============================================================================

/**
 * Mobile preview
 */
export const MobilePreview: TransactionTableStory = {
  args: {
    transactions: mockTransactions.slice(0, 2),
    isLoading: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * Tablet preview
 */
export const TabletPreview: TransactionTableStory = {
  args: {
    transactions: mockTransactions,
    isLoading: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

/**
 * Desktop preview
 */
export const DesktopPreview: TransactionTableStory = {
  args: {
    transactions: mockTransactions,
    isLoading: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
};
