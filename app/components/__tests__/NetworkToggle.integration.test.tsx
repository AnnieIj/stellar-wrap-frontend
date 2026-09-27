import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetworkToggle } from '../NetworkToggle';
import { useWrapStore } from '../../store/wrapStore';
import { NetworkSwitchService, NetworkSwitchError } from '../../../src/services/networkSwitchService';

vi.mock('../../../src/services/networkSwitchService', async () => {
  const actual = await vi.importActual<typeof import('../../../src/services/networkSwitchService')>('../../../src/services/networkSwitchService');
  return {
    ...actual,
    NetworkSwitchService: {
      executeSwitch: vi.fn(),
      estimateFee: vi.fn(),
    },
    detectWalletProvider: vi.fn(() => 'freighter'),
  };
});

describe('NetworkToggle component', () => {
  const mockAddress = 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQONFCIUQG74P3UDMQ74P6C6DJCCEF';

  beforeEach(() => {
    vi.clearAllMocks();
    useWrapStore.setState({
      network: 'mainnet',
      address: null,
      status: 'idle',
    });
  });

  it('renders network toggle button showing current network', () => {
    render(<NetworkToggle />);

    expect(screen.getByText(/Network/i)).toBeDefined();
    expect(screen.getByText(/Mainnet/i)).toBeDefined();
  });

  it('switches directly when no wallet is connected and status is idle', () => {
    render(<NetworkToggle />);

    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);

    expect(useWrapStore.getState().network).toBe('testnet');
  });

  it('opens NetworkSwitchModal when wallet address is connected', () => {
    useWrapStore.setState({
      network: 'mainnet',
      address: mockAddress,
      status: 'idle',
    });

    render(<NetworkToggle />);

    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);

    expect(screen.getByText(/Network Switch/i)).toBeDefined();
    expect(screen.getByText(/Signing via Freighter/i)).toBeDefined();
  });

  it('executes transaction switch when user confirms in modal', async () => {
    useWrapStore.setState({
      network: 'mainnet',
      address: mockAddress,
      status: 'idle',
    });

    vi.mocked(NetworkSwitchService.executeSwitch).mockResolvedValueOnce({
      success: true,
      targetNetwork: 'testnet',
      accountAddress: mockAddress,
      walletProvider: 'freighter',
      signedTxXdr: 'AAAA_SIGNED_XDR',
      estimatedFeeStroops: 100n,
      estimatedFeeXlm: '0.00001',
      formattedFee: '0.00001 XLM (100 stroops)',
      timestamp: Date.now(),
    });

    render(<NetworkToggle />);

    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);

    const signButton = screen.getByRole('button', { name: /Sign & Switch/i });
    await act(async () => {
      fireEvent.click(signButton);
    });

    expect(NetworkSwitchService.executeSwitch).toHaveBeenCalledTimes(1);
    expect(useWrapStore.getState().network).toBe('testnet');
  });

  it('handles user rejection gracefully in modal without crashing', async () => {
    useWrapStore.setState({
      network: 'mainnet',
      address: mockAddress,
      status: 'idle',
    });

    const rejectionError = new NetworkSwitchError(
      'USER_REJECTED',
      'Transaction signature was rejected by user in Freighter. Network switch cancelled.',
    );
    vi.mocked(NetworkSwitchService.executeSwitch).mockRejectedValueOnce(rejectionError);

    render(<NetworkToggle />);

    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);

    const signButton = screen.getByRole('button', { name: /Sign & Switch/i });
    await act(async () => {
      fireEvent.click(signButton);
    });

    expect(screen.getByText(/Signature Rejected/i)).toBeDefined();
    expect(
      screen.getByText(/Transaction signature was rejected by user in Freighter/i),
    ).toBeDefined();

    // App state remains on original network
    expect(useWrapStore.getState().network).toBe('mainnet');
  });
});
