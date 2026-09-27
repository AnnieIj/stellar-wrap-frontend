/**
 * useMultiSigWallet — Wallet interaction hook for multi-sig Soroban transactions.
 *
 * Responsibilities
 * ────────────────
 * 1. Connect / disconnect Freighter (or other wallets via WalletKit).
 * 2. Expose typed `propose`, `sign`, and `execute` callbacks that wire the
 *    service layer to the Zustand store's state transitions.
 * 3. Surface a clear, actionable error message for each failure mode —
 *    especially `USER_REJECTED` (user declined the Freighter dialog).
 * 4. Prevent UI hangs: all async paths are guarded by `isLoading` (no
 *    double-submit) and the service's internal timeout races.
 * 5. Never mutate state outside Zustand — all derived values are computed
 *    from the store or returned as stable React state.
 *
 * Usage example
 * ─────────────
 * ```tsx
 * const {
 *   walletAddress,
 *   isWalletConnected,
 *   connectWallet,
 *   propose,
 *   sign,
 *   execute,
 *   txState,
 *   lastError,
 *   displayState,
 * } = useMultiSigWallet();
 * ```
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  isFreighterInstalled,
  connectFreighter,
  getCurrentPublicKey,
} from '../../app/utils/walletConnect';
import {
  proposeMultiSigTransaction,
  signMultiSigProposal,
  executeMultiSigProposal,
  clearMultiSigSimulationCache,
} from '../services/sorobanMultiSigService';
import { useMultiSigStore } from '../store/multiSigStore';
import { useWrapStore } from '../../app/store/wrapStore';

import type {
  MultiSigObserver,
  MultiSigObserverData,
  MultiSigTxState,
  ProposeMultiSigOptions,
  SignMultiSigOptions,
  ExecuteMultiSigOptions,
  MultiSigError,
  MultiSigContractArgs,
} from '../types/multiSig';
import type { MultiSigDisplayState } from '../store/multiSigStore';
import type { Network } from '../config';

// ─── Public interface ─────────────────────────────────────────────────────────

export interface ProposeParams {
  /** Additional co-signer public keys (the connected wallet is the proposer). */
  additionalSigners: string[];
  /** How many signatures are required. Defaults to all signers. */
  threshold?: number;
  /** 56-char Soroban contract address. Pass empty string to use configured default. */
  contractAddress?: string;
  /** Contract method + args. */
  contractArgs: MultiSigContractArgs;
}

export interface UseMultiSigWalletReturn {
  // ── Wallet connection ──────────────────────────────────────────────────────
  /** Public key of the connected wallet, or null. */
  walletAddress: string | null;
  /** True when a wallet is connected. */
  isWalletConnected: boolean;
  /** True while the wallet connection request is in-flight. */
  isConnecting: boolean;
  /** Connect Freighter and store the address. */
  connectWallet: () => Promise<void>;
  /** Disconnect the wallet (clears local state, does not touch Freighter). */
  disconnectWallet: () => void;

  // ── Transaction lifecycle ──────────────────────────────────────────────────
  /** Current multi-sig lifecycle state. */
  txState: MultiSigTxState;
  /** True while any async multi-sig operation is in-flight. */
  isLoading: boolean;
  /** Structured error from the last failed operation, or null. */
  lastError: MultiSigError | null;
  /** User-facing error string (null when no error). */
  errorMessage: string | null;
  /** Summary display state computed from the current proposal. */
  displayState: MultiSigDisplayState;
  /** True when the connected wallet can sign the current proposal. */
  canSign: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────
  /**
   * Phase 1 — Build and simulate the transaction, creating a proposal.
   * Rejects with `MultiSigError` on failure.
   */
  propose: (params: ProposeParams) => Promise<void>;
  /**
   * Phase 2 — Sign the current proposal with the connected wallet.
   * Rejects with `MultiSigError` on failure (including USER_REJECTED).
   */
  sign: () => Promise<void>;
  /**
   * Phase 3 — Submit the fully-signed envelope and wait for confirmation.
   * Rejects with `MultiSigError` on failure.
   */
  execute: () => Promise<void>;

  /** Clear the current error. */
  clearError: () => void;
  /** Reset the entire multi-sig flow back to idle. */
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMultiSigWallet(): UseMultiSigWalletReturn {
  const store = useMultiSigStore();
  const network = useWrapStore((s) => s.network) as Network;

  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(
    store.connectedWalletAddress,
  );

  // Prevent concurrent calls with a ref-based guard (not state, to avoid
  // triggering re-renders while a call is already running).
  const inFlightRef = useRef(false);

  // ── Sync wallet address with store ──────────────────────────────────────
  // On mount, try to pick up the address Freighter has already granted.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const key = await getCurrentPublicKey();
      if (!cancelled && key) {
        setWalletAddress(key);
        store.setConnectedWalletAddress(key);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Observer factory ─────────────────────────────────────────────────────
  /**
   * Build a `MultiSigObserver` that maps service events to store mutations.
   * Returned as a stable function (no closure over stale state).
   */
  const buildObserver = useCallback((): MultiSigObserver => {
    return (state: MultiSigTxState, data?: MultiSigObserverData) => {
      store.setTxState(state);

      if (!data) return;

      switch (data.kind) {
        case 'confirming':
          store.setConfirmingAttempt(data.attempt);
          break;
        case 'success':
          store.setConfirmed(data.transactionHash, data.ledger);
          break;
        case 'error':
          // The service always throws after emitting 'error'; the catch block
          // in each action calls store.setError.  We set txState here so the
          // UI updates immediately even before the throw propagates.
          store.setTxState(state);
          break;
        default:
          break;
      }
    };
  }, [store]);

  // ── connectWallet ────────────────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);

    try {
      const installed = await isFreighterInstalled();
      if (!installed) {
        throw new Error(
          'Freighter is not installed. Visit freighter.app to get started.',
        );
      }

      const address = await connectFreighter(network);
      setWalletAddress(address);
      store.setConnectedWalletAddress(address);
    } catch (err) {
      // Surface the error through the component via errorMessage; do not
      // call store.setError here because the wallet isn't part of a proposal.
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to connect wallet. Please try again.';
      // Re-throw so the caller can show a toast / banner.
      throw new Error(message);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, network, store]);

  // ── disconnectWallet ─────────────────────────────────────────────────────
  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    store.setConnectedWalletAddress(null);
  }, [store]);

  // ── propose ──────────────────────────────────────────────────────────────
  const propose = useCallback(
    async (params: ProposeParams) => {
      if (inFlightRef.current) return;
      if (!walletAddress) {
        throw new Error('Wallet not connected. Please connect Freighter first.');
      }

      inFlightRef.current = true;
      store.setLoading(true);
      store.clearError();
      clearMultiSigSimulationCache();

      const observer = buildObserver();

      try {
        const options: ProposeMultiSigOptions = {
          network,
          proposerAddress: walletAddress,
          additionalSigners: params.additionalSigners,
          threshold: params.threshold,
          contractAddress: params.contractAddress ?? '',
          contractArgs: params.contractArgs,
          observer,
        };

        const { proposal } = await proposeMultiSigTransaction(options);
        store.setProposal(proposal);
      } catch (err) {
        const multiSigErr = err as MultiSigError;
        store.setError(multiSigErr);
        throw err;
      } finally {
        inFlightRef.current = false;
        store.setLoading(false);
      }
    },
    [walletAddress, network, store, buildObserver],
  );

  // ── sign ─────────────────────────────────────────────────────────────────
  const sign = useCallback(async () => {
    if (inFlightRef.current) return;
    if (!walletAddress) {
      throw new Error('Wallet not connected. Please connect Freighter first.');
    }
    if (!store.currentProposal) {
      throw new Error('No active proposal. Please create a proposal first.');
    }

    inFlightRef.current = true;
    store.setLoading(true);
    store.clearError();

    const observer = buildObserver();

    try {
      const options: SignMultiSigOptions = {
        proposal: store.currentProposal,
        signerAddress: walletAddress,
        observer,
      };

      const { proposal: updatedProposal } = await signMultiSigProposal(options);
      store.updateProposal(updatedProposal);
    } catch (err) {
      const multiSigErr = err as MultiSigError;
      store.setError(multiSigErr);
      throw err;
    } finally {
      inFlightRef.current = false;
      store.setLoading(false);
    }
  }, [walletAddress, store, buildObserver]);

  // ── execute ──────────────────────────────────────────────────────────────
  const execute = useCallback(async () => {
    if (inFlightRef.current) return;
    if (!store.currentProposal) {
      throw new Error('No active proposal. Please create a proposal first.');
    }

    inFlightRef.current = true;
    store.setLoading(true);
    store.clearError();

    const observer = buildObserver();

    try {
      const options: ExecuteMultiSigOptions = {
        proposal: store.currentProposal,
        observer,
      };

      const { transactionHash, ledger } = await executeMultiSigProposal(options);
      store.setConfirmed(transactionHash, ledger);
    } catch (err) {
      const multiSigErr = err as MultiSigError;
      store.setError(multiSigErr);
      throw err;
    } finally {
      inFlightRef.current = false;
      store.setLoading(false);
    }
  }, [store, buildObserver]);

  // ── clearError ───────────────────────────────────────────────────────────
  const clearError = useCallback(() => {
    store.clearError();
  }, [store]);

  // ── reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    inFlightRef.current = false;
    clearMultiSigSimulationCache();
    store.reset();
  }, [store]);

  // ── Derived values ───────────────────────────────────────────────────────
  const displayState = store.getDisplayState();
  const canSign = store.canConnectedWalletSign();
  const errorMessage = store.lastError?.userMessage ?? null;

  return {
    walletAddress,
    isWalletConnected: walletAddress !== null,
    isConnecting,
    connectWallet,
    disconnectWallet,

    txState: store.txState,
    isLoading: store.isLoading,
    lastError: store.lastError,
    errorMessage,
    displayState,
    canSign,

    propose,
    sign,
    execute,
    clearError,
    reset,
  };
}
