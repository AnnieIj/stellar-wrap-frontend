import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NetworkSwitchModal } from '../NetworkSwitchModal';
import { NetworkSwitchError } from '../../../src/services/networkSwitchService';

describe('NetworkSwitchModal component', () => {
  const defaultProps = {
    isOpen: true,
    targetNetwork: 'testnet' as const,
    currentNetwork: 'mainnet' as const,
    status: 'idle' as const,
    walletProvider: 'freighter' as const,
    formattedFee: '0.0000100 XLM (100 stroops)',
    progressMessage: '',
    error: null,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onRetry: vi.fn(),
  };

  it('renders idle state with network details, wallet provider, and 7-decimal fee breakdown', () => {
    render(<NetworkSwitchModal {...defaultProps} />);

    expect(screen.getByText(/Network Switch/i)).toBeDefined();
    expect(screen.getByText(/Signing via Freighter/i)).toBeDefined();
    expect(screen.getByText(/0.0000100 XLM \(100 stroops\)/i)).toBeDefined();
    expect(screen.getByText(/Sign & Switch/i)).toBeDefined();
  });

  it('calls onConfirm when user clicks Sign & Switch', () => {
    const onConfirm = vi.fn();
    render(<NetworkSwitchModal {...defaultProps} onConfirm={onConfirm} />);

    const signButton = screen.getByRole('button', { name: /Sign & Switch/i });
    fireEvent.click(signButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('displays signing status during signature request', () => {
    render(
      <NetworkSwitchModal
        {...defaultProps}
        status="waiting_for_signature"
        progressMessage="Waiting for Freighter signature..."
      />,
    );

    expect(screen.getByText(/Please approve signature in Freighter/i)).toBeDefined();
    expect(screen.getByText(/Waiting for Freighter signature.../i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Cancel Signing/i })).toBeDefined();
  });

  it('displays clear rejection notice when user rejects signature and allows retry', () => {
    const onRetry = vi.fn();
    const rejectionError = new NetworkSwitchError(
      'USER_REJECTED',
      'Transaction signature was rejected by user in Freighter. Network switch cancelled.',
    );

    render(
      <NetworkSwitchModal
        {...defaultProps}
        status="rejected"
        error={rejectionError}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(/Signature Rejected/i)).toBeDefined();
    expect(
      screen.getByText(/Transaction signature was rejected by user in Freighter/i),
    ).toBeDefined();

    const retryBtn = screen.getByRole('button', { name: /Retry Signing/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('displays timeout notice on network latency / timeout', () => {
    const timeoutError = new NetworkSwitchError(
      'TIMEOUT',
      'Network switch timed out. Your wallet took too long to respond.',
    );

    render(
      <NetworkSwitchModal
        {...defaultProps}
        status="timeout"
        error={timeoutError}
      />,
    );

    expect(screen.getByText(/Connection Timeout/i)).toBeDefined();
    expect(screen.getByText(/timed out/i)).toBeDefined();
  });

  it('displays confirmation upon successful switch', () => {
    render(<NetworkSwitchModal {...defaultProps} status="confirmed" />);

    expect(screen.getByText(/Network Switched!/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Done/i })).toBeDefined();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<NetworkSwitchModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });
});
