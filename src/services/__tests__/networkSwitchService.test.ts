import {
  NetworkSwitchService,
  NetworkSwitchError,
  detectWalletProvider,
  parseNetworkSwitchError,
  buildNetworkSwitchTransaction,
  clearAccountStateCache,
} from '../networkSwitchService';
import { signTransaction as freighterSignTransaction } from '@stellar/freighter-api';
import { Keypair } from 'stellar-sdk';

// Mock freighter-api
jest.mock('@stellar/freighter-api', () => ({
  signTransaction: jest.fn(),
  isConnected: jest.fn(),
  getAddress: jest.fn(),
}));

// Mock horizonQueue
jest.mock('../../utils/horizonRequestQueue', () => ({
  horizonQueue: {
    enqueue: jest.fn((fn: () => Promise<unknown>) => fn()),
  },
}));

// Mock stellarClient
const mockLoadAccount = jest.fn();
jest.mock('../../../app/utils/stellarClient', () => ({
  getHorizonServer: jest.fn(() => ({
    loadAccount: mockLoadAccount,
  })),
}));

describe('NetworkSwitchService', () => {
  let mockAddress: string;

  beforeEach(() => {
    jest.clearAllMocks();
    clearAccountStateCache();
    mockAddress = Keypair.random().publicKey();
    mockLoadAccount.mockResolvedValue({
      sequence: '100',
      balances: [{ asset_type: 'native', balance: '50.0000000' }],
    });
  });

  describe('detectWalletProvider', () => {
    const originalWindow = global.window;

    afterEach(() => {
      global.window = originalWindow;
    });

    it('detects freighter when window.freighter is present', () => {
      // @ts-expect-error test window mock
      global.window = { freighter: {} };
      expect(detectWalletProvider()).toBe('freighter');
    });

    it('detects albedo when window.albedo is present', () => {
      // @ts-expect-error test window mock
      global.window = { albedo: {} };
      expect(detectWalletProvider()).toBe('albedo');
    });

    it('detects xbull when window.xBull is present', () => {
      // @ts-expect-error test window mock
      global.window = { xBull: {} };
      expect(detectWalletProvider()).toBe('xbull');
    });

    it('returns unknown when no wallet extension is found', () => {
      // @ts-expect-error test window mock
      global.window = {};
      expect(detectWalletProvider()).toBe('unknown');
    });

    it('returns unknown when window is undefined', () => {
      // @ts-expect-error test window mock
      delete global.window;
      expect(detectWalletProvider()).toBe('unknown');
    });
  });

  describe('parseNetworkSwitchError', () => {
    it('returns existing NetworkSwitchError unchanged', () => {
      const original = new NetworkSwitchError('USER_REJECTED', 'User denied');
      expect(parseNetworkSwitchError(original, 'freighter')).toBe(original);
    });

    it('identifies user rejection across various error messages and wallet types', () => {
      const err1 = parseNetworkSwitchError(new Error('User declined transaction'), 'freighter');
      expect(err1.code).toBe('USER_REJECTED');
      expect(err1.isRejection).toBe(true);
      expect(err1.userMessage).toContain('Freighter');

      const err2 = parseNetworkSwitchError(new Error('Transaction rejected by user'), 'albedo');
      expect(err2.code).toBe('USER_REJECTED');
      expect(err2.isRejection).toBe(true);
      expect(err2.userMessage).toContain('Albedo');

      const err3 = parseNetworkSwitchError(new Error('Popup was closed by user'), 'albedo');
      expect(err3.code).toBe('USER_REJECTED');
      expect(err3.isRejection).toBe(true);

      const err4 = parseNetworkSwitchError(new Error('tx_canceled'), 'xbull');
      expect(err4.code).toBe('USER_REJECTED');
      expect(err4.isRejection).toBe(true);
      expect(err4.userMessage).toContain('xBull');

      const err5 = parseNetworkSwitchError(new Error('User cancelled signature'), 'walletconnect');
      expect(err5.code).toBe('USER_REJECTED');
      expect(err5.userMessage).toContain('wallet');
    });

    it('identifies timeouts and abort errors', () => {
      const err1 = parseNetworkSwitchError(new Error('Operation timed out'), 'freighter');
      expect(err1.code).toBe('TIMEOUT');
      expect(err1.isTimeout).toBe(true);

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      const err2 = parseNetworkSwitchError(abortError, 'freighter');
      expect(err2.code).toBe('TIMEOUT');
      expect(err2.isTimeout).toBe(true);
    });

    it('identifies network and connection errors', () => {
      const err = parseNetworkSwitchError(new Error('Failed to fetch from Horizon network'), 'freighter');
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.userMessage).toContain('Network connection error');
    });

    it('identifies insufficient funds / underfunded errors', () => {
      const err = parseNetworkSwitchError(new Error('Account is underfunded for transaction fee'), 'freighter');
      expect(err.code).toBe('INSUFFICIENT_FUNDS');
      expect(err.userMessage).toContain('Insufficient account balance');
    });

    it('identifies missing/unfunded account errors (404 / not found)', () => {
      const err = parseNetworkSwitchError(new Error('Account not found (404)'), 'freighter');
      expect(err.code).toBe('ACCOUNT_NOT_FOUND');
      expect(err.userMessage).toContain('Account not found or unfunded');
    });

    it('handles string errors and unknown error types', () => {
      const err1 = parseNetworkSwitchError('Direct string error', 'freighter');
      expect(err1.code).toBe('UNKNOWN');
      expect(err1.userMessage).toBe('Direct string error');

      const err2 = parseNetworkSwitchError({ someRandom: 'object' }, 'freighter');
      expect(err2.code).toBe('UNKNOWN');
      expect(err2.userMessage).toContain('unexpected error');
    });
  });

  describe('buildNetworkSwitchTransaction & fetchAccountStateWithCache', () => {
    it('constructs a valid transaction on testnet with 100 stroops base fee', async () => {
      const { transaction, estimatedFeeStroops } = await buildNetworkSwitchTransaction(
        'testnet',
        mockAddress,
      );

      expect(transaction).toBeDefined();
      expect(estimatedFeeStroops).toBe(BigInt(100));
      expect(mockLoadAccount).toHaveBeenCalledTimes(1);
    });

    it('utilizes cache for subsequent calls preventing redundant RPC requests', async () => {
      await buildNetworkSwitchTransaction('testnet', mockAddress);
      await buildNetworkSwitchTransaction('testnet', mockAddress);

      // Should only load account once due to cache
      expect(mockLoadAccount).toHaveBeenCalledTimes(1);
    });

    it('falls back cleanly to sequence 0 if account is not found (404)', async () => {
      mockLoadAccount.mockRejectedValue({ status: 404, message: 'Resource Not Found' });

      const { transaction, estimatedFeeStroops } = await buildNetworkSwitchTransaction(
        'testnet',
        mockAddress,
      );

      expect(transaction).toBeDefined();
      expect(estimatedFeeStroops).toBe(100n);
    });

    it('throws timeout error if signal was aborted before loading account', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        buildNetworkSwitchTransaction('testnet', mockAddress, 'memo', controller.signal),
      ).rejects.toThrow(NetworkSwitchError);
    });
  });

  describe('estimateFee', () => {
    it('returns estimated fee in stroops and XLM with 7 decimal precision', async () => {
      const fee = await NetworkSwitchService.estimateFee('testnet', mockAddress);

      expect(fee.estimatedFeeStroops).toBe(BigInt(100));
      expect(fee.estimatedFeeXlm).toBe('0.00001');
      expect(fee.formattedFee).toBe('0.00001 XLM (100 stroops)');
    });

    it('returns default fallback fee if transaction build fails', async () => {
      mockLoadAccount.mockRejectedValue(new Error('Fatal Horizon connection failure'));

      const fee = await NetworkSwitchService.estimateFee('mainnet', mockAddress);

      expect(fee.estimatedFeeStroops).toBe(BigInt(100));
      expect(fee.estimatedFeeXlm).toBe('0.00001');
      expect(fee.formattedFee).toBe('0.00001 XLM (100 stroops)');
    });
  });

  describe('executeSwitch with Freighter', () => {
    it('completes full switch flow successfully when user approves signature', async () => {
      (freighterSignTransaction as jest.Mock).mockResolvedValue({
        signedTxXdr: 'AAAA...SIGNED_XDR...',
      });

      const observer = jest.fn();
      const result = await NetworkSwitchService.executeSwitch({
        targetNetwork: 'testnet',
        accountAddress: mockAddress,
        walletProvider: 'freighter',
        observer,
      });

      expect(result.success).toBe(true);
      expect(result.targetNetwork).toBe('testnet');
      expect(result.signedTxXdr).toBe('AAAA...SIGNED_XDR...');
      expect(result.estimatedFeeStroops).toBe(BigInt(100));
      expect(result.estimatedFeeXlm).toBe('0.00001');

      const states = observer.mock.calls.map((c) => c[0].status);
      expect(states).toContain('preparing');
      expect(states).toContain('simulating');
      expect(states).toContain('waiting_for_signature');
      expect(states).toContain('submitting');
      expect(states).toContain('confirmed');
    });

    it('gracefully handles user rejection in Freighter with clear error reporting', async () => {
      (freighterSignTransaction as jest.Mock).mockResolvedValue({
        error: 'User declined the transaction',
      });

      const observer = jest.fn();

      await expect(
        NetworkSwitchService.executeSwitch({
          targetNetwork: 'mainnet',
          accountAddress: mockAddress,
          walletProvider: 'freighter',
          observer,
        }),
      ).rejects.toThrow(NetworkSwitchError);

      const rejectedCall = observer.mock.calls.find((c) => c[0].status === 'rejected');
      expect(rejectedCall).toBeDefined();
      expect(rejectedCall[0].error.code).toBe('USER_REJECTED');
      expect(rejectedCall[0].message).toContain('rejected by user in Freighter');
    });

    it('handles empty signedTxXdr from Freighter gracefully', async () => {
      (freighterSignTransaction as jest.Mock).mockResolvedValue({
        signedTxXdr: null,
      });

      await expect(
        NetworkSwitchService.executeSwitch({
          targetNetwork: 'testnet',
          accountAddress: mockAddress,
          walletProvider: 'freighter',
        }),
      ).rejects.toThrow(NetworkSwitchError);
    });

    it('handles connection timeouts gracefully without crashing', async () => {
      (freighterSignTransaction as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );

      const observer = jest.fn();

      await expect(
        NetworkSwitchService.executeSwitch({
          targetNetwork: 'testnet',
          accountAddress: mockAddress,
          walletProvider: 'freighter',
          timeoutMs: 50,
          observer,
        }),
      ).rejects.toThrow(NetworkSwitchError);

      const timeoutCall = observer.mock.calls.find((c) => c[0].status === 'timeout');
      expect(timeoutCall).toBeDefined();
      expect(timeoutCall[0].error.code).toBe('TIMEOUT');
      expect(timeoutCall[0].message).toContain('timed out');
    });

    it('handles AbortSignal before execution starts', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        NetworkSwitchService.executeSwitch({
          targetNetwork: 'testnet',
          accountAddress: mockAddress,
          walletProvider: 'freighter',
          signal: controller.signal,
        }),
      ).rejects.toThrow(NetworkSwitchError);
    });

    it('tolerates observer exceptions without crashing execution', async () => {
      (freighterSignTransaction as jest.Mock).mockResolvedValue({
        signedTxXdr: 'AAAA...SIGNED_XDR...',
      });

      const faultyObserver = jest.fn(() => {
        throw new Error('Observer UI crash');
      });

      const result = await NetworkSwitchService.executeSwitch({
        targetNetwork: 'testnet',
        accountAddress: mockAddress,
        walletProvider: 'freighter',
        observer: faultyObserver,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('executeSwitch with Albedo', () => {
    const originalWindow = global.window;

    afterEach(() => {
      global.window = originalWindow;
    });

    it('completes switch flow when signed with Albedo', async () => {
      const mockAlbedoTx = jest.fn().mockResolvedValue({
        signed_envelope_xdr: 'AAAA...ALBEDO_SIGNED_XDR...',
      });

      // @ts-expect-error test window mock
      global.window = {
        albedo: {
          tx: mockAlbedoTx,
        },
      };

      const result = await NetworkSwitchService.executeSwitch({
        targetNetwork: 'mainnet',
        accountAddress: mockAddress,
        walletProvider: 'albedo',
      });

      expect(result.success).toBe(true);
      expect(result.signedTxXdr).toBe('AAAA...ALBEDO_SIGNED_XDR...');
      expect(mockAlbedoTx).toHaveBeenCalledWith({
        xdr: expect.any(String),
        network: 'public',
      });
    });

    it('throws WALLET_NOT_INSTALLED if Albedo is missing from window', async () => {
      // @ts-expect-error test window mock
      global.window = {};

      await expect(
        NetworkSwitchService.executeSwitch({
          targetNetwork: 'testnet',
          accountAddress: mockAddress,
          walletProvider: 'albedo',
        }),
      ).rejects.toThrow(NetworkSwitchError);
    });

    it('throws error if Albedo returns empty signed envelope', async () => {
      const mockAlbedoTx = jest.fn().mockResolvedValue({
        signed_envelope_xdr: '',
      });

      // @ts-expect-error test window mock
      global.window = {
        albedo: {
          tx: mockAlbedoTx,
        },
      };

      await expect(
        NetworkSwitchService.executeSwitch({
          targetNetwork: 'testnet',
          accountAddress: mockAddress,
          walletProvider: 'albedo',
        }),
      ).rejects.toThrow(NetworkSwitchError);
    });

    it('handles Albedo user cancellation gracefully', async () => {
      const mockAlbedoTx = jest.fn().mockRejectedValue(new Error('User rejected the transaction'));

      // @ts-expect-error test window mock
      global.window = {
        albedo: {
          tx: mockAlbedoTx,
        },
      };

      const observer = jest.fn();

      await expect(
        NetworkSwitchService.executeSwitch({
          targetNetwork: 'testnet',
          accountAddress: mockAddress,
          walletProvider: 'albedo',
          observer,
        }),
      ).rejects.toThrow(NetworkSwitchError);

      const rejectedCall = observer.mock.calls.find((c) => c[0].status === 'rejected');
      expect(rejectedCall).toBeDefined();
      expect(rejectedCall[0].error.code).toBe('USER_REJECTED');
      expect(rejectedCall[0].message).toContain('rejected by user in Albedo');
    });
  });

  describe('executeSwitch with xBull', () => {
    const originalWindow = global.window;

    afterEach(() => {
      global.window = originalWindow;
    });

    it('completes switch flow when signed with xBull', async () => {
      const mockSignXDR = jest.fn().mockResolvedValue('AAAA...XBULL_SIGNED_XDR...');

      // @ts-expect-error test window mock
      global.window = {
        xBull: {
          signXDR: mockSignXDR,
        },
      };

      const result = await NetworkSwitchService.executeSwitch({
        targetNetwork: 'testnet',
        accountAddress: mockAddress,
        walletProvider: 'xbull',
      });

      expect(result.success).toBe(true);
      expect(result.signedTxXdr).toBe('AAAA...XBULL_SIGNED_XDR...');
      expect(mockSignXDR).toHaveBeenCalledWith(expect.any(String), {
        network: 'testnet',
      });
    });

    it('throws WALLET_NOT_INSTALLED if xBull is missing from window', async () => {
      // @ts-expect-error test window mock
      global.window = {};

      await expect(
        NetworkSwitchService.executeSwitch({
          targetNetwork: 'testnet',
          accountAddress: mockAddress,
          walletProvider: 'xbull',
        }),
      ).rejects.toThrow(NetworkSwitchError);
    });

    it('throws error if xBull signXDR is not available', async () => {
      // @ts-expect-error test window mock
      global.window = {
        xBull: {},
      };

      await expect(
        NetworkSwitchService.executeSwitch({
          targetNetwork: 'testnet',
          accountAddress: mockAddress,
          walletProvider: 'xbull',
        }),
      ).rejects.toThrow(NetworkSwitchError);
    });
  });
});
