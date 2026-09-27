/**
 * Type definitions for the Multi-Signature Soroban transaction domain.
 *
 * A multi-sig flow involves three phases:
 *   1. Propose  — one signer creates and simulates the transaction, producing an XDR envelope.
 *   2. Sign     — additional required signers add their authorisations.
 *   3. Execute  — any party submits the fully-authorised envelope and polls for confirmation.
 *
 * All monetary amounts in this module follow Stellar's 7-decimal-place precision
 * (1 XLM = 10_000_000 stroops). Use the `stroopsToXlm` / `xlmToStroops` helpers
 * in `src/utils/sorobanConverter.ts` or the utilities exposed here to stay safe.
 */

import type { Network } from '../config';

// ─── Stroops / Amount helpers ────────────────────────────────────────────────

/** Type alias that documents a value is expressed in stroops (integer). */
export type Stroops = bigint;

/** Type alias that documents a value is expressed in XLM (7-dp decimal string). */
export type XlmAmount = string;

/**
 * Converts an XLM string (e.g. "1.2500000") to stroops.
 * Throws if the input has more than 7 decimal places.
 */
export function xlmToStroops(xlm: XlmAmount): Stroops {
  const parts = xlm.split('.');
  const whole = parts[0] ?? '0';
  const frac = (parts[1] ?? '').padEnd(7, '0').slice(0, 7);
  if (parts.length > 1 && (parts[1] ?? '').length > 7) {
    throw new RangeError(
      `Amount "${xlm}" has more than 7 decimal places — Stellar only supports 7-dp precision.`,
    );
  }
  return BigInt(whole) * 10_000_000n + BigInt(frac);
}

/**
 * Converts a stroops value to a 7-dp XLM string (e.g. 12500000n → "1.2500000").
 */
export function stroopsToXlm(stroops: Stroops): XlmAmount {
  const whole = stroops / 10_000_000n;
  const frac = (stroops % 10_000_000n).toString().padStart(7, '0');
  return `${whole}.${frac}`;
}

// ─── Transaction lifecycle ────────────────────────────────────────────────────

/**
 * All possible states a multi-sig transaction can be in.
 *
 * `proposed`   – XDR envelope assembled, awaiting co-signers.
 * `signing`    – A signer is currently authorising (Freighter dialog open).
 * `signed`     – This signer's key has been applied; may still need more.
 * `ready`      – All required signatures collected; ready to submit.
 * `submitting` – RPC `sendTransaction` in flight.
 * `submitted`  – Hash received; awaiting ledger inclusion.
 * `confirming` – `getTransaction` polling in progress.
 * `confirmed`  – Ledger accepted the transaction.
 * `failed`     – Terminal failure at any stage.
 * `rejected`   – User explicitly declined signing in their wallet.
 * `timeout`    – Confirmation polling exceeded the deadline.
 */
export type MultiSigTxState =
  | 'idle'
  | 'building'
  | 'simulating'
  | 'proposed'
  | 'signing'
  | 'signed'
  | 'ready'
  | 'submitting'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'failed'
  | 'rejected'
  | 'timeout';

// ─── Signer ──────────────────────────────────────────────────────────────────

/** One participant in the multi-sig quorum. */
export interface MultiSigSigner {
  /** Stellar G-prefixed public key. */
  publicKey: string;
  /** Whether this signer has provided their signature authorisation. */
  hasSigned: boolean;
  /** ISO-8601 timestamp of when the signature was added, if signed. */
  signedAt: string | null;
}

// ─── Proposal ────────────────────────────────────────────────────────────────

/**
 * Identifies which Soroban contract function to invoke.
 * Add more discriminants as new contract methods are supported.
 */
export type MultiSigContractMethod =
  | 'mint_wrap'
  | 'submit_stats'
  | 'update_config'
  | 'custom';

/**
 * Generic contract invocation arguments.  The multi-sig service accepts
 * these and delegates ScVal conversion to `contractArgsBuilder`.
 */
export interface MultiSigContractArgs {
  /** Target contract method name. */
  method: MultiSigContractMethod;
  /** Raw JS values; the service maps these to ScVal types. */
  params: Record<string, unknown>;
}

/**
 * Proposal created by the initiating signer.  Stored and shared with
 * co-signers who must each call `signProposal`.
 */
export interface MultiSigProposal {
  /** Unique identifier (deterministic hash of network + contract + method + params + proposer). */
  id: string;
  /** Network the transaction targets. */
  network: Network;
  /** 56-char Soroban contract address. */
  contractAddress: string;
  /** Contract method and arguments. */
  contractArgs: MultiSigContractArgs;
  /** Base64-encoded unsigned transaction XDR envelope. */
  unsignedXdr: string;
  /** Base64-encoded assembled XDR that accumulates authorisations. */
  assembledXdr: string;
  /** Ordered list of required signers. */
  signers: MultiSigSigner[];
  /** Minimum number of signers required (threshold). */
  threshold: number;
  /** Stellar account address that initiated the proposal. */
  proposedBy: string;
  /** ISO-8601 creation timestamp. */
  proposedAt: string;
  /** ISO-8601 expiry timestamp (proposal expires if not executed by this time). */
  expiresAt: string;
  /** Simulation result captured when the proposal was created. */
  simulationResult: MultiSigSimulationResult;
  /** Current lifecycle state of this proposal. */
  state: MultiSigTxState;
  /** Transaction hash once submitted. */
  transactionHash: string | null;
  /** Ledger number at confirmation. */
  confirmedLedger: number | null;
}

// ─── Simulation ──────────────────────────────────────────────────────────────

/** Estimated resource costs from Soroban simulation. */
export interface MultiSigSimulationCost {
  /** CPU instructions consumed. */
  cpuInsns: number;
  /** Memory bytes consumed. */
  memBytes: number;
}

/** Ledger key footprint from simulation. */
export interface MultiSigSimulationFootprint {
  readOnly: string[];
  readWrite: string[];
}

/** Detailed simulation result for a proposed multi-sig transaction. */
export interface MultiSigSimulationResult {
  success: boolean;
  error?: string;
  cost?: MultiSigSimulationCost;
  footprint?: MultiSigSimulationFootprint;
  /** Estimated fee in XLM (7-dp string). */
  estimatedFeeXlm?: XlmAmount;
  /** Estimated fee in stroops. */
  estimatedFeeStroops?: Stroops;
  /** Account balance in XLM at time of simulation. */
  accountBalanceXlm?: XlmAmount;
  /** Whether a ledger entry restore preamble is required. */
  requiresRestore?: boolean;
}

// ─── Service options ──────────────────────────────────────────────────────────

/** Options passed to `proposeMultiSigTransaction`. */
export interface ProposeMultiSigOptions {
  /** Soroban network to target. */
  network: Network;
  /** Initiating signer's Stellar public key. */
  proposerAddress: string;
  /** Additional required co-signers (public keys). */
  additionalSigners: string[];
  /** How many signatures are required before executing (default: all). */
  threshold?: number;
  /** Contract to invoke. */
  contractAddress: string;
  /** Method + args to encode. */
  contractArgs: MultiSigContractArgs;
  /** Observer callback for state transitions. */
  observer?: MultiSigObserver;
}

/** Options passed to `signMultiSigProposal`. */
export interface SignMultiSigOptions {
  /** The proposal to sign. */
  proposal: MultiSigProposal;
  /** Public key of the signer adding their authorisation. */
  signerAddress: string;
  /** Observer callback for state transitions. */
  observer?: MultiSigObserver;
}

/** Options passed to `executeMultiSigProposal`. */
export interface ExecuteMultiSigOptions {
  /** The fully-signed proposal to submit. */
  proposal: MultiSigProposal;
  /** Observer callback for state transitions. */
  observer?: MultiSigObserver;
}

// ─── Observer ────────────────────────────────────────────────────────────────

/**
 * Callback fired on each state transition during a multi-sig RPC operation.
 * The `data` payload is specific to each state — UI code should use
 * the narrowed type guards exported alongside this type.
 */
export type MultiSigObserver = (
  state: MultiSigTxState,
  data?: MultiSigObserverData,
) => void;

/** Possible shapes of the observer `data` payload. */
export type MultiSigObserverData =
  | MultiSigObserverSimulating
  | MultiSigObserverSigning
  | MultiSigObserverConfirming
  | MultiSigObserverError
  | MultiSigObserverSuccess;

export interface MultiSigObserverSimulating {
  kind: 'simulating';
  simulation?: MultiSigSimulationResult;
  cached?: boolean;
}

export interface MultiSigObserverSigning {
  kind: 'signing';
  signerAddress: string;
}

export interface MultiSigObserverConfirming {
  kind: 'confirming';
  attempt: number;
  maxAttempts: number;
  elapsedMs: number;
  transactionHash: string;
}

export interface MultiSigObserverError {
  kind: 'error';
  error: string;
  code?: MultiSigErrorCode;
}

export interface MultiSigObserverSuccess {
  kind: 'success';
  transactionHash: string;
  ledger: number;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Structured error codes for multi-sig failures. */
export type MultiSigErrorCode =
  | 'USER_REJECTED'
  | 'NETWORK_MISMATCH'
  | 'SIMULATION_FAILED'
  | 'INSUFFICIENT_BALANCE'
  | 'THRESHOLD_NOT_MET'
  | 'PROPOSAL_EXPIRED'
  | 'ALREADY_SIGNED'
  | 'NOT_AUTHORISED'
  | 'SUBMISSION_FAILED'
  | 'CONFIRMATION_TIMEOUT'
  | 'RATE_LIMITED'
  | 'CONNECTION_TIMEOUT'
  | 'CONTRACT_ERROR'
  | 'UNKNOWN';

/** Rich error type used throughout the multi-sig domain. */
export class MultiSigError extends Error {
  readonly code: MultiSigErrorCode;
  readonly state: MultiSigTxState;
  readonly userMessage: string;

  constructor(
    code: MultiSigErrorCode,
    state: MultiSigTxState,
    userMessage: string,
    cause?: unknown,
  ) {
    super(userMessage);
    this.name = 'MultiSigError';
    this.code = code;
    this.state = state;
    this.userMessage = userMessage;
    if (cause !== undefined) {
      // Node.js ≥ 16.9 supports Error.cause natively; set it for diagnostics.
      (this as Error & { cause: unknown }).cause = cause;
    }
    Object.setPrototypeOf(this, MultiSigError.prototype);
  }
}

// ─── Result types ─────────────────────────────────────────────────────────────

/** Returned by a successful `proposeMultiSigTransaction` call. */
export interface ProposeResult {
  proposal: MultiSigProposal;
}

/** Returned by a successful `signMultiSigProposal` call. */
export interface SignResult {
  /** Updated proposal with this signer's authorisation applied. */
  proposal: MultiSigProposal;
  /** Whether the threshold is now met (ready to execute). */
  thresholdMet: boolean;
}

/** Returned by a successful `executeMultiSigProposal` call. */
export interface ExecuteResult {
  transactionHash: string;
  ledger: number;
}
