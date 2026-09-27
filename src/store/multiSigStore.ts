/**
 * Multi-Signature Zustand Store
 *
 * Manages the client-side state of an in-progress multi-sig transaction
 * across all three phases: propose → sign → execute.
 *
 * Design decisions
 * ────────────────
 * - The store is intentionally NOT persisted.  Multi-sig proposals are
 *   ephemeral client state; persistence would need a backend or encrypted
 *   local storage to avoid XDR leaking.  Components should handle page-
 *   reload by showing the user a "start fresh" prompt.
 * - `currentProposal` is the single source of truth.  The `signerStatus`
 *   selector is a derived view computed at read time.
 * - `lastError` retains the most recent `MultiSigError` so the UI can
 *   branch on `lastError.code` (e.g. show a "rejected" vs "timed out" UI).
 */

import { create } from 'zustand';

import type {
  MultiSigProposal,
  MultiSigTxState,
  MultiSigError,
} from '../../src/types/multiSig';
import {
  countSignatures,
  isThresholdMet,
  isProposalExpired,
} from '../../src/services/sorobanMultiSigService';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-signer view computed from the proposal signers list. */
export interface SignerStatus {
  publicKey: string;
  hasSigned: boolean;
  signedAt: string | null;
  isProposer: boolean;
}

/** Snapshot of the multi-sig panel's display state. */
export interface MultiSigDisplayState {
  phase: 'idle' | 'propose' | 'sign' | 'execute' | 'done' | 'error';
  totalSigners: number;
  signedCount: number;
  threshold: number;
  thresholdMet: boolean;
  isExpired: boolean;
}

/** Full state managed by this store. */
export interface MultiSigStoreState {
  // ── Data ──────────────────────────────────────────────────────────────────
  /** The active proposal, or null if no flow is in progress. */
  currentProposal: MultiSigProposal | null;
  /** Current lifecycle phase. */
  txState: MultiSigTxState;
  /** The last structured error, or null if no error has occurred. */
  lastError: MultiSigError | null;
  /** Transaction hash once the proposal is executed. */
  transactionHash: string | null;
  /** Ledger number at confirmation. */
  confirmedLedger: number | null;
  /** True while an async operation (propose / sign / execute) is in-flight. */
  isLoading: boolean;
  /** 1-based poll attempt counter while in 'confirming' state. */
  confirmingAttempt: number | null;
  /** The public key of the wallet currently connected in this session. */
  connectedWalletAddress: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  /** Called when proposeMultiSigTransaction resolves. */
  setProposal: (proposal: MultiSigProposal) => void;
  /** Apply updated proposal returned by signMultiSigProposal. */
  updateProposal: (proposal: MultiSigProposal) => void;
  /** Advance the lifecycle state (driven by the observer). */
  setTxState: (state: MultiSigTxState) => void;
  /** Store a structured error and set txState to 'failed'. */
  setError: (error: MultiSigError) => void;
  /** Clear any error. */
  clearError: () => void;
  /** Record confirmation details. */
  setConfirmed: (transactionHash: string, ledger: number) => void;
  /** Update the in-progress poll counter. */
  setConfirmingAttempt: (attempt: number | null) => void;
  /** Set the loading flag. */
  setLoading: (loading: boolean) => void;
  /** Store the connected wallet address. */
  setConnectedWalletAddress: (address: string | null) => void;
  /** Reset all state to initial values. */
  reset: () => void;

  // ── Selectors (derived state) ──────────────────────────────────────────────
  /** Returns per-signer view, or [] if no proposal. */
  getSignerStatuses: () => SignerStatus[];
  /** Returns a summary for the UI display panel. */
  getDisplayState: () => MultiSigDisplayState;
  /**
   * True if the connected wallet is in the proposal's signer list and
   * has not yet signed.
   */
  canConnectedWalletSign: () => boolean;
}

// ─── Initial values ───────────────────────────────────────────────────────────

const INITIAL_STATE = {
  currentProposal: null,
  txState: 'idle' as MultiSigTxState,
  lastError: null,
  transactionHash: null,
  confirmedLedger: null,
  isLoading: false,
  confirmingAttempt: null,
  connectedWalletAddress: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMultiSigStore = create<MultiSigStoreState>()((set, get) => ({
  ...INITIAL_STATE,

  // ── Actions ─────────────────────────────────────────────────────────────

  setProposal: (proposal) =>
    set({
      currentProposal: proposal,
      txState: proposal.state,
      lastError: null,
      transactionHash: null,
      confirmedLedger: null,
      isLoading: false,
    }),

  updateProposal: (proposal) =>
    set((state) => ({
      currentProposal: proposal,
      txState: proposal.state,
      // Keep previous error if the update doesn't change state to an error.
      lastError:
        proposal.state === 'failed' ? state.lastError : null,
    })),

  setTxState: (txState) => set({ txState }),

  setError: (error) =>
    set({
      lastError: error,
      txState: error.state,
      isLoading: false,
    }),

  clearError: () => set({ lastError: null }),

  setConfirmed: (transactionHash, confirmedLedger) =>
    set({
      transactionHash,
      confirmedLedger,
      txState: 'confirmed',
      isLoading: false,
      confirmingAttempt: null,
    }),

  setConfirmingAttempt: (confirmingAttempt) => set({ confirmingAttempt }),

  setLoading: (isLoading) => set({ isLoading }),

  setConnectedWalletAddress: (connectedWalletAddress) =>
    set({ connectedWalletAddress }),

  reset: () => set({ ...INITIAL_STATE }),

  // ── Selectors ────────────────────────────────────────────────────────────

  getSignerStatuses: () => {
    const { currentProposal } = get();
    if (!currentProposal) return [];
    return currentProposal.signers.map((signer): SignerStatus => ({
      publicKey: signer.publicKey,
      hasSigned: signer.hasSigned,
      signedAt: signer.signedAt,
      isProposer: signer.publicKey === currentProposal.proposedBy,
    }));
  },

  getDisplayState: (): MultiSigDisplayState => {
    const { currentProposal, txState, lastError, transactionHash } = get();

    if (!currentProposal) {
      return {
        phase: 'idle',
        totalSigners: 0,
        signedCount: 0,
        threshold: 0,
        thresholdMet: false,
        isExpired: false,
      };
    }

    const totalSigners = currentProposal.signers.length;
    const signedCount = countSignatures(currentProposal);
    const threshold = currentProposal.threshold;
    const thresholdMet = isThresholdMet(currentProposal);
    const isExpired = isProposalExpired(currentProposal);

    let phase: MultiSigDisplayState['phase'];
    if (lastError) {
      phase = 'error';
    } else if (txState === 'confirmed' || transactionHash) {
      phase = 'done';
    } else if (
      txState === 'submitting' ||
      txState === 'submitted' ||
      txState === 'confirming'
    ) {
      phase = 'execute';
    } else if (txState === 'proposed' || txState === 'signing' || txState === 'signed') {
      phase = 'sign';
    } else if (txState === 'building' || txState === 'simulating') {
      phase = 'propose';
    } else if (txState === 'ready') {
      // Threshold met, waiting for execute call.
      phase = 'execute';
    } else {
      phase = 'idle';
    }

    return {
      phase,
      totalSigners,
      signedCount,
      threshold,
      thresholdMet,
      isExpired,
    };
  },

  canConnectedWalletSign: () => {
    const { currentProposal, connectedWalletAddress } = get();
    if (!currentProposal || !connectedWalletAddress) return false;
    const signer = currentProposal.signers.find(
      (s) => s.publicKey === connectedWalletAddress,
    );
    return !!signer && !signer.hasSigned;
  },
}));
