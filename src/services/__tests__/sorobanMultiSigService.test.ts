/**
 * Unit tests for the Multi-Sig Soroban service and Zustand store.
 *
 * Scope
 * ─────
 * - `xlmToStroops` / `stroopsToXlm` precision helpers
 * - `MultiSigError` construction and fields
 * - `useMultiSigStore` — all actions and selectors
 * - `sorobanMultiSigService` — propose, sign, execute, and error scenarios
 *   (RPC calls are mocked so no network access is required)
 *
 * Run with:
 *   pnpm test:unit   (Jest, matches __tests__/** pattern in jest.config.js)
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────
// Must be declared before any import that transitively reaches the mocked modules.

jest.mock('@stellar/freighter-api', () => ({
  signTransaction: jest.fn(),
  isConnected: jest.fn(),
  getAddress: jest.fn(),
  getNetworkDetails: jest.fn(),
  requestAccess: jest.fn(),
}));

jest.mock('stellar-sdk', () => {
  const actual = jest.requireActual('stellar-sdk');

  // Minimal Account stub that TransactionBuilder needs.
  class MockAccount {
    private sequence: bigint;
    constructor(public id: string, seq: string) {
      this.sequence = BigInt(seq);
    }
    accountId() { return this.id; }
    sequenceNumber() { return this.sequence.toString(); }
    incrementSequenceNumber() { this.sequence += 1n; }
  }

  // Minimal Transaction stub.
  class MockTransaction {
    toXDR() { return 'base64mockxdr=='; }
    toEnvelope() { return { toXDR: () => Buffer.from('mock') }; }
  }

  // TransactionBuilder must be a proper class (not object spread).
  class MockTransactionBuilder {
    constructor(_account: unknown, _opts: unknown) {}
    addOperation() { return this; }
    setTimeout() { return this; }
    build() { return new MockTransaction(); }
    static fromXDR() { return new MockTransaction(); }
  }

  // Contract stub.
  class MockContract {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    call(_method: string, ..._args: unknown[]) { return 'mockOp'; }
  }

  // ScVal stub: the instanceof check in buildScArgs uses xdr.ScVal
  // which is a class in the real SDK. We need a stub class here so
  // `value instanceof xdr.ScVal` returns false for plain strings/numbers.
  class MockScVal {}

  return {
    ...actual,
    Contract: MockContract,
    Transaction: MockTransaction,
    TransactionBuilder: MockTransactionBuilder,
    BASE_FEE: '100',
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: jest.fn().mockResolvedValue({
          balances: [{ asset_type: 'native', balance: '100.0000000' }],
        }),
      })),
    },
    xdr: {
      ...actual.xdr,
      ScVal: Object.assign(MockScVal, {
        scvString: jest.fn((v: string) => ({ type: 'string', value: v })),
        scvU32: jest.fn((v: number) => ({ type: 'u32', value: v })),
        scvU64: jest.fn((v: unknown) => ({ type: 'u64', value: v })),
        scvBool: jest.fn((v: boolean) => ({ type: 'bool', value: v })),
        scvBytes: jest.fn((v: Buffer) => ({ type: 'bytes', value: v })),
      }),
      TransactionEnvelope: {
        fromXDR: jest.fn().mockReturnValue({
          toXDR: () => Buffer.from('mock'),
        }),
      },
      Uint64: jest.fn().mockImplementation((lo: number, hi: number) => ({ lo, hi })),
    },
  };
});

jest.mock('stellar-sdk/rpc', () => {
  class MockServer {
    getAccount = jest.fn();
    simulateTransaction = jest.fn();
    sendTransaction = jest.fn();
    getTransaction = jest.fn();
  }

  return {
    Server: jest.fn().mockImplementation(() => new MockServer()),
    Api: {
      GetTransactionStatus: {
        SUCCESS: 'SUCCESS',
        FAILED: 'FAILED',
        NOT_FOUND: 'NOT_FOUND',
      },
    },
  };
});

// Mock HorizonRequestQueue to pass through calls directly (no queuing).
// Resolved relative to this test file (src/services/__tests__/ → src/utils/).
jest.mock('../../utils/horizonRequestQueue', () => {
  class MockQueue {
    async enqueue<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    }
    clear() {}
  }
  return { HorizonRequestQueue: MockQueue, horizonQueue: new MockQueue() };
});

// Mock config/contracts so we can control the contract address.
// Resolved relative to this test file (src/services/__tests__/ → config/).
jest.mock('../../../config/contracts', () => ({
  getContractAddress: jest.fn().mockReturnValue(
    'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
  ),
  isPlaceholderContractAddress: jest.fn().mockReturnValue(false),
  PlaceholderContractAddressError: class PlaceholderContractAddressError extends Error {
    userMessage = 'placeholder';
    developerHint = 'hint';
    network = 'testnet';
    constructor() { super('placeholder'); }
  },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { signTransaction } from '@stellar/freighter-api';
import { Server } from 'stellar-sdk/rpc';

import {
  xlmToStroops,
  stroopsToXlm,
  MultiSigError,
} from '../../types/multiSig';
import type { MultiSigProposal } from '../../types/multiSig';

import { useMultiSigStore } from '../../store/multiSigStore';

import {
  proposeMultiSigTransaction,
  signMultiSigProposal,
  executeMultiSigProposal,
  countSignatures,
  isThresholdMet,
  isProposalExpired,
  clearMultiSigSimulationCache,
} from '../sorobanMultiSigService';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const PROPOSER = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
const COSIGNER = 'GBVZKEY27JCGO5VJKFNJ5LFFAJRNPZ5BGKJZGFBOPNV65AJVZFQBSYP';
const CONTRACT = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const TX_HASH  = 'abc123def456abc123def456abc123def456abc123def456abc123def456ab12';

/** Build a bare-minimum proposal for sign / execute tests. */
function makeProposal(overrides: Partial<MultiSigProposal> = {}): MultiSigProposal {
  const now = Date.now();
  return {
    id: 'msig-test-001',
    network: 'testnet',
    contractAddress: CONTRACT,
    contractArgs: { method: 'mint_wrap', params: { period: 'monthly' } },
    unsignedXdr: 'base64mockxdr==',
    assembledXdr: 'base64mockxdr==',
    signers: [
      { publicKey: PROPOSER, hasSigned: false, signedAt: null, isProposer: true },
      { publicKey: COSIGNER, hasSigned: false, signedAt: null, isProposer: false },
    ] as unknown as MultiSigProposal['signers'],
    threshold: 2,
    proposedBy: PROPOSER,
    proposedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 3_600_000).toISOString(), // 1 h from now
    simulationResult: { success: true, estimatedFeeXlm: '0.0000100' },
    state: 'proposed',
    transactionHash: null,
    confirmedLedger: null,
    ...overrides,
  };
}

/** Get a fresh server mock for assertions. */
function getServerMock() {
  return (Server as jest.Mock).mock.results[
    (Server as jest.Mock).mock.results.length - 1
  ]?.value as {
    getAccount: jest.Mock;
    simulateTransaction: jest.Mock;
    sendTransaction: jest.Mock;
    getTransaction: jest.Mock;
  };
}

/** Reset Zustand store between tests. */
function resetStore() {
  useMultiSigStore.setState({
    currentProposal: null,
    txState: 'idle',
    lastError: null,
    transactionHash: null,
    confirmedLedger: null,
    isLoading: false,
    confirmingAttempt: null,
    connectedWalletAddress: null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — Amount helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('xlmToStroops / stroopsToXlm', () => {
  it('converts 1.0000000 XLM to 10_000_000 stroops', () => {
    expect(xlmToStroops('1.0000000')).toBe(10_000_000n);
  });

  it('converts 0.0000001 XLM (1 stroop)', () => {
    expect(xlmToStroops('0.0000001')).toBe(1n);
  });

  it('converts whole XLM with no fractional part', () => {
    expect(xlmToStroops('50')).toBe(500_000_000n);
  });

  it('round-trips: stroops → xlm → stroops', () => {
    const original = 1_234_567n;
    expect(xlmToStroops(stroopsToXlm(original))).toBe(original);
  });

  it('throws on more than 7 decimal places', () => {
    expect(() => xlmToStroops('0.00000001')).toThrow(RangeError);
  });

  it('stroopsToXlm formats zero correctly', () => {
    expect(stroopsToXlm(0n)).toBe('0.0000000');
  });

  it('stroopsToXlm pads fractional part to 7 digits', () => {
    expect(stroopsToXlm(1n)).toBe('0.0000001');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — MultiSigError
// ─────────────────────────────────────────────────────────────────────────────

describe('MultiSigError', () => {
  it('has the expected fields', () => {
    const err = new MultiSigError('USER_REJECTED', 'rejected', 'You declined the signature.');
    expect(err.code).toBe('USER_REJECTED');
    expect(err.state).toBe('rejected');
    expect(err.userMessage).toBe('You declined the signature.');
    expect(err.message).toBe('You declined the signature.');
    expect(err.name).toBe('MultiSigError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(MultiSigError);
  });

  it('accepts an optional cause', () => {
    const cause = new Error('original');
    const err = new MultiSigError('UNKNOWN', 'failed', 'wrapped', cause);
    expect((err as Error & { cause: unknown }).cause).toBe(cause);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — Zustand store
// ─────────────────────────────────────────────────────────────────────────────

describe('useMultiSigStore', () => {
  beforeEach(resetStore);

  describe('initial state', () => {
    it('starts with null proposal and idle state', () => {
      const s = useMultiSigStore.getState();
      expect(s.currentProposal).toBeNull();
      expect(s.txState).toBe('idle');
      expect(s.lastError).toBeNull();
      expect(s.transactionHash).toBeNull();
      expect(s.isLoading).toBe(false);
    });
  });

  describe('setProposal', () => {
    it('stores the proposal and resets error fields', () => {
      const proposal = makeProposal();
      useMultiSigStore.getState().setProposal(proposal);
      const s = useMultiSigStore.getState();
      expect(s.currentProposal).toBe(proposal);
      expect(s.txState).toBe('proposed');
      expect(s.lastError).toBeNull();
      expect(s.transactionHash).toBeNull();
    });
  });

  describe('updateProposal', () => {
    it('updates the proposal and clears error when state is not failed', () => {
      const original = makeProposal();
      useMultiSigStore.getState().setProposal(original);

      const updated: MultiSigProposal = {
        ...original,
        state: 'signed',
        signers: original.signers.map((s, i) =>
          i === 0 ? { ...s, hasSigned: true, signedAt: new Date().toISOString() } : s,
        ),
      };
      useMultiSigStore.getState().updateProposal(updated);

      const s = useMultiSigStore.getState();
      expect(s.currentProposal).toBe(updated);
      expect(s.txState).toBe('signed');
      expect(s.lastError).toBeNull();
    });
  });

  describe('setError', () => {
    it('stores the error, sets txState to the error state, and clears loading', () => {
      useMultiSigStore.getState().setLoading(true);

      const err = new MultiSigError('USER_REJECTED', 'rejected', 'Declined');
      useMultiSigStore.getState().setError(err);

      const s = useMultiSigStore.getState();
      expect(s.lastError).toBe(err);
      expect(s.txState).toBe('rejected');
      expect(s.isLoading).toBe(false);
    });
  });

  describe('clearError', () => {
    it('removes the last error', () => {
      const err = new MultiSigError('UNKNOWN', 'failed', 'oops');
      useMultiSigStore.getState().setError(err);
      useMultiSigStore.getState().clearError();
      expect(useMultiSigStore.getState().lastError).toBeNull();
    });
  });

  describe('setConfirmed', () => {
    it('stores hash + ledger and sets state to confirmed', () => {
      useMultiSigStore.getState().setConfirmed(TX_HASH, 42);
      const s = useMultiSigStore.getState();
      expect(s.transactionHash).toBe(TX_HASH);
      expect(s.confirmedLedger).toBe(42);
      expect(s.txState).toBe('confirmed');
      expect(s.isLoading).toBe(false);
      expect(s.confirmingAttempt).toBeNull();
    });
  });

  describe('reset', () => {
    it('returns all fields to initial values', () => {
      const proposal = makeProposal();
      useMultiSigStore.getState().setProposal(proposal);
      useMultiSigStore.getState().setConfirmed(TX_HASH, 10);
      useMultiSigStore.getState().reset();

      const s = useMultiSigStore.getState();
      expect(s.currentProposal).toBeNull();
      expect(s.txState).toBe('idle');
      expect(s.transactionHash).toBeNull();
      expect(s.confirmedLedger).toBeNull();
    });
  });

  describe('getSignerStatuses', () => {
    it('returns empty array when no proposal exists', () => {
      expect(useMultiSigStore.getState().getSignerStatuses()).toEqual([]);
    });

    it('returns one entry per signer with isProposer flag', () => {
      useMultiSigStore.getState().setProposal(makeProposal());
      const statuses = useMultiSigStore.getState().getSignerStatuses();
      expect(statuses).toHaveLength(2);
      const proposerEntry = statuses.find((s) => s.publicKey === PROPOSER);
      expect(proposerEntry?.isProposer).toBe(true);
      const cosignerEntry = statuses.find((s) => s.publicKey === COSIGNER);
      expect(cosignerEntry?.isProposer).toBe(false);
    });
  });

  describe('getDisplayState', () => {
    it('returns idle display state when no proposal exists', () => {
      const display = useMultiSigStore.getState().getDisplayState();
      expect(display.phase).toBe('idle');
      expect(display.totalSigners).toBe(0);
      expect(display.threshold).toBe(0);
    });

    it('returns sign phase when proposal is in proposed state', () => {
      useMultiSigStore.getState().setProposal(makeProposal({ state: 'proposed' }));
      const display = useMultiSigStore.getState().getDisplayState();
      expect(display.phase).toBe('sign');
      expect(display.totalSigners).toBe(2);
      expect(display.threshold).toBe(2);
      expect(display.thresholdMet).toBe(false);
      expect(display.isExpired).toBe(false);
    });

    it('returns execute phase when in submitting state', () => {
      useMultiSigStore.getState().setProposal(makeProposal({ state: 'proposed' }));
      useMultiSigStore.getState().setTxState('submitting');
      const display = useMultiSigStore.getState().getDisplayState();
      expect(display.phase).toBe('execute');
    });

    it('returns done phase when confirmed', () => {
      useMultiSigStore.getState().setProposal(makeProposal({ state: 'confirmed' }));
      useMultiSigStore.getState().setConfirmed(TX_HASH, 99);
      const display = useMultiSigStore.getState().getDisplayState();
      expect(display.phase).toBe('done');
    });

    it('detects expired proposal', () => {
      const expired = makeProposal({
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      useMultiSigStore.getState().setProposal(expired);
      const display = useMultiSigStore.getState().getDisplayState();
      expect(display.isExpired).toBe(true);
    });
  });

  describe('canConnectedWalletSign', () => {
    it('returns false when no wallet is connected', () => {
      useMultiSigStore.getState().setProposal(makeProposal());
      expect(useMultiSigStore.getState().canConnectedWalletSign()).toBe(false);
    });

    it('returns true when connected wallet is an unsigned signer', () => {
      useMultiSigStore.getState().setProposal(makeProposal());
      useMultiSigStore.getState().setConnectedWalletAddress(PROPOSER);
      expect(useMultiSigStore.getState().canConnectedWalletSign()).toBe(true);
    });

    it('returns false when connected wallet has already signed', () => {
      const proposal = makeProposal({
        signers: [
          { publicKey: PROPOSER, hasSigned: true, signedAt: new Date().toISOString() },
          { publicKey: COSIGNER, hasSigned: false, signedAt: null },
        ] as unknown as MultiSigProposal['signers'],
      });
      useMultiSigStore.getState().setProposal(proposal);
      useMultiSigStore.getState().setConnectedWalletAddress(PROPOSER);
      expect(useMultiSigStore.getState().canConnectedWalletSign()).toBe(false);
    });

    it('returns false when wallet is not in the signer list', () => {
      useMultiSigStore.getState().setProposal(makeProposal());
      useMultiSigStore.getState().setConnectedWalletAddress(
        'GNOTINSIGNERLISTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      );
      expect(useMultiSigStore.getState().canConnectedWalletSign()).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — Service utility functions
// ─────────────────────────────────────────────────────────────────────────────

describe('countSignatures', () => {
  it('returns 0 when no signers have signed', () => {
    expect(countSignatures(makeProposal())).toBe(0);
  });

  it('counts only signed signers', () => {
    const proposal = makeProposal({
      signers: [
        { publicKey: PROPOSER, hasSigned: true,  signedAt: new Date().toISOString() },
        { publicKey: COSIGNER, hasSigned: false, signedAt: null },
      ] as unknown as MultiSigProposal['signers'],
    });
    expect(countSignatures(proposal)).toBe(1);
  });
});

describe('isThresholdMet', () => {
  it('returns false when fewer than threshold signers have signed', () => {
    expect(isThresholdMet(makeProposal())).toBe(false);
  });

  it('returns true when threshold is met', () => {
    const proposal = makeProposal({
      threshold: 1,
      signers: [
        { publicKey: PROPOSER, hasSigned: true, signedAt: new Date().toISOString() },
        { publicKey: COSIGNER, hasSigned: false, signedAt: null },
      ] as unknown as MultiSigProposal['signers'],
    });
    expect(isThresholdMet(proposal)).toBe(true);
  });
});

describe('isProposalExpired', () => {
  it('returns false for a future expiry', () => {
    expect(isProposalExpired(makeProposal())).toBe(false);
  });

  it('returns true for a past expiry', () => {
    const expired = makeProposal({
      expiresAt: new Date(Date.now() - 1).toISOString(),
    });
    expect(isProposalExpired(expired)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 5 — proposeMultiSigTransaction
// ─────────────────────────────────────────────────────────────────────────────

describe('proposeMultiSigTransaction', () => {
  beforeEach(() => {
    clearMultiSigSimulationCache();
    (Server as jest.Mock).mockClear();
  });

  function setupSuccessfulSimulation() {
    const mockServer = {
      getAccount: jest.fn().mockResolvedValue({
        id: PROPOSER,
        sequenceNumber: () => '0',
        incrementSequenceNumber: () => {},
        accountId: () => PROPOSER,
      }),
      simulateTransaction: jest.fn().mockResolvedValue({
        cost: { cpuInsns: 1000, memBytes: 5000 },
        footprint: { readOnly: [], readWrite: [] },
      }),
      sendTransaction: jest.fn(),
      getTransaction: jest.fn(),
    };
    (Server as jest.Mock).mockImplementation(() => mockServer);
    return mockServer;
  }

  it('returns a proposal with the correct structure', async () => {
    setupSuccessfulSimulation();

    const { proposal } = await proposeMultiSigTransaction({
      network: 'testnet',
      proposerAddress: PROPOSER,
      additionalSigners: [COSIGNER],
      contractAddress: CONTRACT,
      contractArgs: { method: 'mint_wrap', params: { period: 'monthly' } },
    });

    expect(proposal.id).toMatch(/^msig-/);
    expect(proposal.network).toBe('testnet');
    expect(proposal.proposedBy).toBe(PROPOSER);
    expect(proposal.signers).toHaveLength(2);
    expect(proposal.threshold).toBe(2);
    expect(proposal.state).toBe('proposed');
    expect(proposal.transactionHash).toBeNull();
    expect(proposal.simulationResult.success).toBe(true);
  });

  it('deduplicates proposer from additionalSigners', async () => {
    setupSuccessfulSimulation();

    const { proposal } = await proposeMultiSigTransaction({
      network: 'testnet',
      proposerAddress: PROPOSER,
      additionalSigners: [PROPOSER, COSIGNER], // proposer duplicated
      contractAddress: CONTRACT,
      contractArgs: { method: 'mint_wrap', params: {} },
    });

    const keys = proposal.signers.map((s) => s.publicKey);
    expect(keys).toEqual([...new Set(keys)]); // unique
    expect(keys).toContain(PROPOSER);
    expect(keys).toContain(COSIGNER);
  });

  it('respects a custom threshold below signer count', async () => {
    setupSuccessfulSimulation();

    const { proposal } = await proposeMultiSigTransaction({
      network: 'testnet',
      proposerAddress: PROPOSER,
      additionalSigners: [COSIGNER],
      threshold: 1,
      contractAddress: CONTRACT,
      contractArgs: { method: 'mint_wrap', params: {} },
    });

    expect(proposal.threshold).toBe(1);
  });

  it('calls the observer with building → simulating → proposed', async () => {
    setupSuccessfulSimulation();
    const states: string[] = [];

    await proposeMultiSigTransaction({
      network: 'testnet',
      proposerAddress: PROPOSER,
      additionalSigners: [],
      contractAddress: CONTRACT,
      contractArgs: { method: 'mint_wrap', params: {} },
      observer: (state) => states.push(state),
    });

    expect(states).toContain('building');
    expect(states).toContain('simulating');
    expect(states).toContain('proposed');
  });

  it('throws MultiSigError with SIMULATION_FAILED when simulation errors', async () => {
    const mockServer = {
      getAccount: jest.fn().mockResolvedValue({
        id: PROPOSER,
        sequenceNumber: () => '0',
        incrementSequenceNumber: () => {},
        accountId: () => PROPOSER,
      }),
      simulateTransaction: jest.fn().mockResolvedValue({
        error: 'HostError: Contract(5)',
      }),
      sendTransaction: jest.fn(),
      getTransaction: jest.fn(),
    };
    (Server as jest.Mock).mockImplementation(() => mockServer);

    await expect(
      proposeMultiSigTransaction({
        network: 'testnet',
        proposerAddress: PROPOSER,
        additionalSigners: [],
        contractAddress: CONTRACT,
        contractArgs: { method: 'mint_wrap', params: {} },
      }),
    ).rejects.toBeInstanceOf(MultiSigError);
  });

  it('throws when account is not found', async () => {
    const mockServer = {
      getAccount: jest.fn().mockRejectedValue(
        new Error('Not Found: account does not exist'),
      ),
      simulateTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      getTransaction: jest.fn(),
    };
    (Server as jest.Mock).mockImplementation(() => mockServer);

    await expect(
      proposeMultiSigTransaction({
        network: 'testnet',
        proposerAddress: PROPOSER,
        additionalSigners: [],
        contractAddress: CONTRACT,
        contractArgs: { method: 'mint_wrap', params: {} },
      }),
    ).rejects.toThrow(/not found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 6 — signMultiSigProposal
// ─────────────────────────────────────────────────────────────────────────────

describe('signMultiSigProposal', () => {
  const signMock = signTransaction as jest.Mock;

  beforeEach(() => {
    signMock.mockReset();
  });

  it('marks the signer as signed and updates assembledXdr', async () => {
    signMock.mockResolvedValue({ signedTxXdr: 'signedxdr==', error: undefined });

    const proposal = makeProposal();
    const { proposal: updated, thresholdMet } = await signMultiSigProposal({
      proposal,
      signerAddress: PROPOSER,
    });

    const signerEntry = updated.signers.find((s) => s.publicKey === PROPOSER);
    expect(signerEntry?.hasSigned).toBe(true);
    expect(signerEntry?.signedAt).not.toBeNull();
    expect(updated.assembledXdr).toBe('signedxdr==');
    // Only 1 of 2 signed — threshold (2) not met yet.
    expect(thresholdMet).toBe(false);
    expect(updated.state).toBe('signed');
  });

  it('sets thresholdMet = true and state = ready when last signer signs', async () => {
    signMock.mockResolvedValue({ signedTxXdr: 'signedxdr2==', error: undefined });

    // Both signers required; first already signed.
    const proposal = makeProposal({
      threshold: 2,
      signers: [
        { publicKey: PROPOSER, hasSigned: true,  signedAt: new Date().toISOString() },
        { publicKey: COSIGNER, hasSigned: false, signedAt: null },
      ] as unknown as MultiSigProposal['signers'],
    });

    const { thresholdMet, proposal: updated } = await signMultiSigProposal({
      proposal,
      signerAddress: COSIGNER,
    });

    expect(thresholdMet).toBe(true);
    expect(updated.state).toBe('ready');
  });

  it('throws USER_REJECTED when Freighter returns error containing "User declined"', async () => {
    signMock.mockResolvedValue({
      signedTxXdr: undefined,
      error: 'User declined to sign the transaction',
    });

    const proposal = makeProposal();

    await expect(
      signMultiSigProposal({ proposal, signerAddress: PROPOSER }),
    ).rejects.toMatchObject({ code: 'USER_REJECTED' });
  });

  it('throws USER_REJECTED when signTransaction throws with "User rejected"', async () => {
    signMock.mockRejectedValue(new Error('User rejected signing'));

    const proposal = makeProposal();

    await expect(
      signMultiSigProposal({ proposal, signerAddress: PROPOSER }),
    ).rejects.toMatchObject({ code: 'USER_REJECTED' });
  });

  it('throws NOT_AUTHORISED when signer is not in the proposal list', async () => {
    const proposal = makeProposal();
    await expect(
      signMultiSigProposal({
        proposal,
        signerAddress: 'GNOTINSIGNERLISTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      }),
    ).rejects.toMatchObject({ code: 'NOT_AUTHORISED' });
  });

  it('throws ALREADY_SIGNED when signer has signed before', async () => {
    const proposal = makeProposal({
      signers: [
        { publicKey: PROPOSER, hasSigned: true, signedAt: new Date().toISOString() },
        { publicKey: COSIGNER, hasSigned: false, signedAt: null },
      ] as unknown as MultiSigProposal['signers'],
    });
    await expect(
      signMultiSigProposal({ proposal, signerAddress: PROPOSER }),
    ).rejects.toMatchObject({ code: 'ALREADY_SIGNED' });
  });

  it('throws PROPOSAL_EXPIRED when proposal TTL has elapsed', async () => {
    const expired = makeProposal({
      expiresAt: new Date(Date.now() - 1).toISOString(),
    });
    await expect(
      signMultiSigProposal({ proposal: expired, signerAddress: PROPOSER }),
    ).rejects.toMatchObject({ code: 'PROPOSAL_EXPIRED' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 7 — executeMultiSigProposal
// ─────────────────────────────────────────────────────────────────────────────

describe('executeMultiSigProposal', () => {
  function makeReadyProposal(): MultiSigProposal {
    return makeProposal({
      state: 'ready',
      threshold: 1,
      signers: [
        { publicKey: PROPOSER, hasSigned: true, signedAt: new Date().toISOString() },
        { publicKey: COSIGNER, hasSigned: false, signedAt: null },
      ] as unknown as MultiSigProposal['signers'],
    });
  }

  function setupExecutionServer(
    txStatus: 'SUCCESS' | 'FAILED' | 'NOT_FOUND' = 'SUCCESS',
  ) {
    const mockServer = {
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      sendTransaction: jest.fn().mockResolvedValue({ hash: TX_HASH, errorResult: undefined }),
      getTransaction: jest.fn().mockResolvedValue({ status: txStatus, ledger: 100 }),
    };
    (Server as jest.Mock).mockImplementation(() => mockServer);
    return mockServer;
  }

  it('returns transactionHash and ledger on success', async () => {
    setupExecutionServer('SUCCESS');

    const result = await executeMultiSigProposal({ proposal: makeReadyProposal() });
    expect(result.transactionHash).toBe(TX_HASH);
    expect(result.ledger).toBe(100);
  });

  it('calls observer with submitting → submitted → confirming → confirmed', async () => {
    setupExecutionServer('SUCCESS');
    const states: string[] = [];

    await executeMultiSigProposal({
      proposal: makeReadyProposal(),
      observer: (state) => states.push(state),
    });

    expect(states).toContain('submitting');
    expect(states).toContain('submitted');
    expect(states).toContain('confirming');
    expect(states).toContain('confirmed');
  });

  it('throws THRESHOLD_NOT_MET when not enough signers have signed', async () => {
    setupExecutionServer('SUCCESS');

    // threshold=2 but only 1 signed.
    const proposal = makeProposal({ threshold: 2 });

    await expect(
      executeMultiSigProposal({ proposal }),
    ).rejects.toMatchObject({ code: 'THRESHOLD_NOT_MET' });
  });

  it('throws PROPOSAL_EXPIRED for expired proposals', async () => {
    setupExecutionServer('SUCCESS');

    const expired = makeProposal({
      threshold: 1,
      expiresAt: new Date(Date.now() - 1).toISOString(),
      signers: [
        { publicKey: PROPOSER, hasSigned: true, signedAt: new Date().toISOString() },
        { publicKey: COSIGNER, hasSigned: false, signedAt: null },
      ] as unknown as MultiSigProposal['signers'],
    });

    await expect(
      executeMultiSigProposal({ proposal: expired }),
    ).rejects.toMatchObject({ code: 'PROPOSAL_EXPIRED' });
  });

  it('throws SUBMISSION_FAILED when network returns a FAILED status', async () => {
    setupExecutionServer('FAILED');

    await expect(
      executeMultiSigProposal({ proposal: makeReadyProposal() }),
    ).rejects.toMatchObject({ code: 'SUBMISSION_FAILED' });
  });

  it('throws when sendTransaction returns errorResult', async () => {
    const mockServer = {
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      sendTransaction: jest.fn().mockResolvedValue({
        hash: TX_HASH,
        errorResult: { message: 'insufficient_fee' },
      }),
      getTransaction: jest.fn(),
    };
    (Server as jest.Mock).mockImplementation(() => mockServer);

    await expect(
      executeMultiSigProposal({ proposal: makeReadyProposal() }),
    ).rejects.toBeInstanceOf(MultiSigError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 8 — Rate limiting interaction
// ─────────────────────────────────────────────────────────────────────────────

describe('Rate-limit handling in executeMultiSigProposal', () => {
  it('propagates a rate-limit error as a MultiSigError with RATE_LIMITED code', async () => {
    const mockServer = {
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      sendTransaction: jest.fn().mockRejectedValue(new Error('429 rate limit exceeded')),
      getTransaction: jest.fn(),
    };
    (Server as jest.Mock).mockImplementation(() => mockServer);

    const proposal = makeProposal({
      threshold: 1,
      signers: [
        { publicKey: PROPOSER, hasSigned: true, signedAt: new Date().toISOString() },
        { publicKey: COSIGNER, hasSigned: false, signedAt: null },
      ] as unknown as MultiSigProposal['signers'],
    });

    await expect(
      executeMultiSigProposal({ proposal }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });
});
