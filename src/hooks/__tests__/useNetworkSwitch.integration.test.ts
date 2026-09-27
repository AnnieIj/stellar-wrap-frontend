import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNetworkSwitch } from '../useNetworkSwitch';
import { NetworkSwitchService, NetworkSwitchError } from '../../services/networkSwitchService';

vi.mock('../../services/networkSwitchService', async () => {
  const actual = await vi.importActual<typeof import('../../services/networkSwitchService')>('../../services/networkSwitchService');
  return {
    ...actual,
    NetworkSwitchService: {
      executeSwitch: vi.fn(),
      estimateFee: vi.fn(),
    },
    detectWalletProvider: vi.fn(() => 'freighter'),
  };
});

describe('useNetworkSwitch hook', () => {
  const mockAddress = 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQONFCIUQG74P3UDMQ74P6C6DJCCEF';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default idle state', () => {
    const { result } = renderHook(() => useNetworkSwitch());

    expect(result.current.status).toBe('idle');
    expect(result.current.isSwitching).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.targetNetwork).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('updates state across successful network switch lifecycle', async () => {
    vi.mocked(NetworkSwitchService.executeSwitch).mockImplementation(
      async ({ observer }) => {
        if (observer) {
          observer({
            status: 'waiting_for_signature',
            targetNetwork: 'testnet',
            accountAddress: mockAddress,
            walletProvider: 'freighter',
            estimatedFeeStroops: 100n,
            estimatedFeeXlm: '0.00001',
            formattedFee: '0.00001 XLM (100 stroops)',
            message: 'Waiting for Freighter signature...',
          });
        }
        return {
          success: true,
          targetNetwork: 'testnet',
          accountAddress: mockAddress,
          walletProvider: 'freighter',
          signedTxXdr: 'AAAA_SIGNED_XDR',
          estimatedFeeStroops: 100n,
          estimatedFeeXlm: '0.00001',
          formattedFee: '0.00001 XLM (100 stroops)',
          timestamp: Date.now(),
        };
      },
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useNetworkSwitch({ onSuccess }));

    let res;
    await act(async () => {
      res = await result.current.switchNetwork({
        targetNetwork: 'testnet',
        accountAddress: mockAddress,
      });
    });

    expect(res).toBeDefined();
    expect(result.current.status).toBe('confirmed');
    expect(result.current.isSwitching).toBe(false);
    expect(result.current.result?.success).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('handles user rejection gracefully without crashing', async () => {
    const rejectionError = new NetworkSwitchError(
      'USER_REJECTED',
      'Transaction signature was rejected by user in Freighter.',
    );
    vi.mocked(NetworkSwitchService.executeSwitch).mockRejectedValue(rejectionError);

    const onError = vi.fn();
    const { result } = renderHook(() => useNetworkSwitch({ onError }));

    await act(async () => {
      await result.current.switchNetwork({
        targetNetwork: 'mainnet',
        accountAddress: mockAddress,
      });
    });

    expect(result.current.status).toBe('rejected');
    expect(result.current.isSwitching).toBe(false);
    expect(result.current.error?.code).toBe('USER_REJECTED');
    expect(onError).toHaveBeenCalledWith(rejectionError);

    // Test clearError
    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('handles timeout status correctly and supports retry', async () => {
    const timeoutError = new NetworkSwitchError(
      'TIMEOUT',
      'Network switch timed out. Your wallet took too long to respond.',
    );
    vi.mocked(NetworkSwitchService.executeSwitch).mockRejectedValueOnce(timeoutError);

    const { result } = renderHook(() => useNetworkSwitch());

    await act(async () => {
      await result.current.switchNetwork({
        targetNetwork: 'testnet',
        accountAddress: mockAddress,
      });
    });

    expect(result.current.status).toBe('timeout');

    // Setup success for retry
    vi.mocked(NetworkSwitchService.executeSwitch).mockResolvedValueOnce({
      success: true,
      targetNetwork: 'testnet',
      accountAddress: mockAddress,
      walletProvider: 'freighter',
      estimatedFeeStroops: 100n,
      estimatedFeeXlm: '0.00001',
      formattedFee: '0.00001 XLM (100 stroops)',
      timestamp: Date.now(),
    });

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.status).toBe('confirmed');
  });

  it('cancels an in-flight switch and resets state', async () => {
    vi.mocked(NetworkSwitchService.executeSwitch).mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    const { result } = renderHook(() => useNetworkSwitch());

    act(() => {
      void result.current.switchNetwork({
        targetNetwork: 'testnet',
        accountAddress: mockAddress,
      });
    });

    expect(result.current.isSwitching).toBe(true);

    act(() => {
      result.current.cancelSwitch();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.isSwitching).toBe(false);
  });
});
