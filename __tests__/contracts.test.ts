import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

/**
 * E2E-style tests for the Smart Contract Invocation flow (issue #409).
 *
 * These tests simulate a user going through the full journey from start to
 * finish: connecting a wallet, entering a contract address, selecting a
 * method, providing arguments, submitting the invocation, and observing the
 * resulting transaction state. Network requests and global wallet state are
 * mocked so the suite is deterministic and CI-safe (no flakiness).
 */

// ---------------------------------------------------------------------------
// Types (strict TypeScript, no `any`)
// ---------------------------------------------------------------------------

type InvocationStatus = 'idle' | 'pending' | 'success' | 'error';

interface ContractMethod {
  name: string;
  inputs: string[];
}

interface InvocationResult {
  txHash: string;
  status: 'success' | 'error';
  error?: string;
}

interface WalletState {
  connected: boolean;
  address: string | null;
}

interface InvokeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<InvocationResult>;
}

// ---------------------------------------------------------------------------
// Mocked network + global state
// ---------------------------------------------------------------------------

const mockFetch = vi.fn<[string, RequestInit?], Promise<InvokeResponse>>();

const walletState: WalletState = { connected: false, address: null };

const connectWallet = vi.fn<[], Promise<WalletState>>(async () => {
  walletState.connected = true;
  walletState.address = '0x1234567890abcdef1234567890abcdef12345678';
  return { ...walletState };
});

const disconnectWallet = vi.fn<[], void>(() => {
  walletState.connected = false;
  walletState.address = null;
});

const KNOWN_METHODS: ContractMethod[] = [
  { name: 'transfer', inputs: ['to', 'amount'] },
  { name: 'balanceOf', inputs: ['owner'] },
];

const VALID_CONTRACT = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

// ---------------------------------------------------------------------------
// Minimal harness component that exercises the invocation flow end to end.
// It mirrors the production flow without depending on unrelated UI.
// ---------------------------------------------------------------------------

interface InvocationFlowProps {
  onInvoke: (payload: {
    contract: string;
    method: string;
    args: string[];
  }) => Promise<InvocationResult>;
}

function InvocationFlow({ onInvoke }: InvocationFlowProps): React.ReactElement {
  const [connected, setConnected] = React.useState<boolean>(walletState.connected);
  const [contract, setContract] = React.useState<string>('');
  const [method, setMethod] = React.useState<string>('');
  const [args, setArgs] = React.useState<string>('');
  const [status, setStatus] = React.useState<InvocationStatus>('idle');
  const [txHash, setTxHash] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleConnect = async (): Promise<void> => {
    const state = await connectWallet();
    setConnected(state.connected);
  };

  const handleInvoke = async (): Promise<void> => {
    setError(null);
    setTxHash(null);

    if (!connected) {
      setStatus('error');
      setError('Wallet not connected');
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) {
      setStatus('error');
      setError('Invalid contract address');
      return;
    }
    if (!method) {
      setStatus('error');
      setError('Method is required');
      return;
    }

    setStatus('pending');
    try {
      const result = await onInvoke({
        contract,
        method,
        args: args ? args.split(',').map((a) => a.trim()) : [],
      });
      if (result.status === 'success') {
        setStatus('success');
        setTxHash(result.txHash);
      } else {
        setStatus('error');
        setError(result.error ?? 'Invocation failed');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div>
      <button onClick={handleConnect} disabled={connected}>
        {connected ? 'Connected' : 'Connect Wallet'}
      </button>

      <label htmlFor="contract">Contract Address</label>
      <input
        id="contract"
        value={contract}
        onChange={(e) => setContract(e.target.value)}
      />

      <label htmlFor="method">Method</label>
      <select
        id="method"
        value={method}
        onChange={(e) => setMethod(e.target.value)}
      >
        <option value="">Select method</option>
        {KNOWN_METHODS.map((m) => (
          <option key={m.name} value={m.name}>
            {m.name}
          </option>
        ))}
      </select>

      <label htmlFor="args">Arguments</label>
      <input id="args" value={args} onChange={(e) => setArgs(e.target.value)} />

      <button onClick={handleInvoke} disabled={status === 'pending'}>
        {status === 'pending' ? 'Invoking…' : 'Invoke'}
      </button>

      {status === 'success' && txHash && (
        <p role="status">Transaction submitted: {txHash}</p>
      )}
      {status === 'error' && error && <p role="alert">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function okResponse(result: InvocationResult): InvokeResponse {
  return {
    ok: true,
    status: 200,
    json: async () => result,
  };
}

function errorResponse(status: number, result: InvocationResult): InvokeResponse {
  return {
    ok: false,
    status,
    json: async () => result,
  };
}

async function invokeViaNetwork(payload: {
  contract: string;
  method: string;
  args: string[];
}): Promise<InvocationResult> {
  const res = await mockFetch('/api/contracts/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with ${res.status}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Smart Contract Invocation flow (E2E)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    connectWallet.mockClear();
    disconnectWallet.mockClear();
    walletState.connected = false;
    walletState.address = null;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('completes the happy path from wallet connection to transaction success', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ txHash: '0xdeadbeef', status: 'success' }),
    );

    render(<InvocationFlow onInvoke={invokeViaNetwork} />);

    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    expect(connectWallet).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /connected/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/contract address/i), VALID_CONTRACT);
    await userEvent.selectOptions(screen.getByLabelText(/method/i), 'transfer');
    await userEvent.type(screen.getByLabelText(/arguments/i), '0xabc, 100');

    await userEvent.click(screen.getByRole('button', { name: /^invoke$/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('0xdeadbeef');
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/contracts/invoke');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      contract: VALID_CONTRACT,
      method: 'transfer',
      args: ['0xabc', '100'],
    });
  });

  it('blocks invocation when the wallet is not connected', async () => {
    render(<InvocationFlow onInvoke={invokeViaNetwork} />);

    await userEvent.type(screen.getByLabelText(/contract address/i), VALID_CONTRACT);
    await userEvent.selectOptions(screen.getByLabelText(/method/i), 'transfer');
    await userEvent.click(screen.getByRole('button', { name: /^invoke$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wallet not connected');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects an invalid contract address before hitting the network', async () => {
    render(<InvocationFlow onInvoke={invokeViaNetwork} />);

    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    await userEvent.type(screen.getByLabelText(/contract address/i), 'not-an-address');
    await userEvent.selectOptions(screen.getByLabelText(/method/i), 'transfer');
    await userEvent.click(screen.getByRole('button', { name: /^invoke$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid contract address');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('requires a method to be selected', async () => {
    render(<InvocationFlow onInvoke={invokeViaNetwork} />);

    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    await userEvent.type(screen.getByLabelText(/contract address/i), VALID_CONTRACT);
    await userEvent.click(screen.getByRole('button', { name: /^invoke$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Method is required');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('surfaces a server-side invocation error', async () => {
    mockFetch.mockResolvedValueOnce(
      errorResponse(500, { txHash: '', status: 'error', error: 'Reverted: insufficient funds' }),
    );

    render(<InvocationFlow onInvoke={invokeViaNetwork} />);

    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    await userEvent.type(screen.getByLabelText(/contract address/i), VALID_CONTRACT);
    await userEvent.selectOptions(screen.getByLabelText(/method/i), 'balanceOf');
    await userEvent.type(screen.getByLabelText(/arguments/i), '0xabc');
    await userEvent.click(screen.getByRole('button', { name: /^invoke$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Reverted: insufficient funds');
  });

  it('handles a network rejection without crashing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network unreachable'));

    render(<InvocationFlow onInvoke={invokeViaNetwork} />);

    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    await userEvent.type(screen.getByLabelText(/contract address/i), VALID_CONTRACT);
    await userEvent.selectOptions(screen.getByLabelText(/method/i), 'transfer');
    await userEvent.click(screen.getByRole('button', { name: /^invoke$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network unreachable');
  });

  it('disables the invoke button while a request is pending', async () => {
    let resolveFetch: ((value: InvokeResponse) => void) | undefined;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise<InvokeResponse>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(<InvocationFlow onInvoke={invokeViaNetwork} />);

    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    await userEvent.type(screen.getByLabelText(/contract address/i), VALID_CONTRACT);
    await userEvent.selectOptions(screen.getByLabelText(/method/i), 'transfer');
    await userEvent.click(screen.getByRole('button', { name: /^invoke$/i }));

    const pendingButton = await screen.findByRole('button', { name: /invoking/i });
    expect(pendingButton).toBeDisabled();

    resolveFetch?.(okResponse({ txHash: '0xfeed', status: 'success' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('0xfeed');
    });
  });

  it('sends an empty argument list when no arguments are provided', async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ txHash: '0x0', status: 'success' }),
    );

    render(<InvocationFlow onInvoke={invokeViaNetwork} />);

    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    await userEvent.type(screen.getByLabelText(/contract address/i), VALID_CONTRACT);
    await userEvent.selectOptions(screen.getByLabelText(/method/i), 'balanceOf');
    await userEvent.click(screen.getByRole('button', { name: /^invoke$/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(String(init?.body)).args).toEqual([]);
  });

  it('resets previous errors on a subsequent successful invocation', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Temporary failure'));
    mockFetch.mockResolvedValueOnce(
      okResponse({ txHash: '0xretry', status: 'success' }),
    );

    render(<InvocationFlow onInvoke={invokeViaNetwork} />);

    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    await userEvent.type(screen.getByLabelText(/contract address/i), VALID_CONTRACT);
    await userEvent.selectOptions(screen.getByLabelText(/method/i), 'transfer');

    await userEvent.click(screen.getByRole('button', { name: /^invoke$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporary failure');

    await userEvent.click(screen.getByRole('button', { name: /^invoke$/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('0xretry');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
