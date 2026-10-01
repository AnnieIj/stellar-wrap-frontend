/**
 * Tests for HorizonIndexerService.getLedgers (issue #428)
 */

jest.mock('../../utils/horizonRequestQueue', () => ({
    horizonQueue: {
        enqueue: jest.fn((fn: () => Promise<unknown>) => fn()),
    },
}));

const mockCall = jest.fn();
const mockLimit = jest.fn();
const mockOrder = jest.fn();
const mockLedgers = jest.fn();

jest.mock('stellar-sdk', () => ({
    Horizon: {
        Server: jest.fn().mockImplementation(() => ({
            ledgers: mockLedgers,
        })),
    },
}));

jest.mock('../../config', () => ({
    RPC_ENDPOINTS: {
        mainnet: 'https://horizon.stellar.org',
        testnet: 'https://horizon-testnet.stellar.org',
    },
}));

// Import after mocks are set up.
import { horizonIndexer } from '../horizonIndexer';

describe('HorizonIndexerService.getLedgers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLedgers.mockReturnValue({ order: mockOrder });
        mockOrder.mockReturnValue({ limit: mockLimit });
        mockLimit.mockReturnValue({ call: mockCall });
    });

    it('orders desc, applies the given limit, and maps records to the lean RecentLedger shape', async () => {
        mockCall.mockResolvedValue({
            records: [
                {
                    id: 'ledger-1',
                    sequence: 100,
                    hash: 'hash-1',
                    closed_at: '2026-01-01T00:00:00Z',
                    successful_transaction_count: 5,
                    failed_transaction_count: 1,
                    operation_count: 10,
                },
            ],
        });

        const result = await horizonIndexer.getLedgers('mainnet', 20);

        expect(mockOrder).toHaveBeenCalledWith('desc');
        expect(mockLimit).toHaveBeenCalledWith(20);
        expect(result).toEqual([
            {
                id: 'ledger-1',
                sequence: 100,
                hash: 'hash-1',
                closedAt: '2026-01-01T00:00:00Z',
                successfulTransactionCount: 5,
                failedTransactionCount: 1,
                operationCount: 10,
            },
        ]);
    });

    it('defaults to a limit of 20 when none is given', async () => {
        mockCall.mockResolvedValue({ records: [] });

        await horizonIndexer.getLedgers('mainnet');

        expect(mockLimit).toHaveBeenCalledWith(20);
    });

    it('propagates request failures rather than swallowing them', async () => {
        mockCall.mockRejectedValue(new Error('network down'));

        await expect(horizonIndexer.getLedgers('mainnet')).rejects.toThrow('network down');
    });
});
