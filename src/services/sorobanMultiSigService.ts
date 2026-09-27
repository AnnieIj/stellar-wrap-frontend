/**
 * Multi-Signature Soroban RPC Service
 *
 * Implements the three-phase multi-sig contract invocation flow:
 *   1. `proposeMultiSigTransaction` — simulate + build unsigned XDR envelope.
 *   2. `signMultiSigProposal`       — apply one signer's Freighter authorisation.
 *   3. `executeMultiSigProposal`    — submit fully-authorised envelope and poll.
 *
 * Rate-limiting concerns
 * ──────────────────────
 * All Soroban RPC calls are wrapped with the `sorobanRpcQueue` (a dedicated
 * `HorizonRequestQueue` instance) so that parallel callers share the same
 * back-pressure and exponential-backoff logic.  Simulation results are cached
 * for `SIMULATION_CACHE_TTL_MS` to avoid redundant round-trips.
 *
 * Timeout handling
 * ────────────────
 * `executeMultiSigProposal` wraps polling in a `Promise.race` against a
 * `CONNECTION_TIMEOUT_MS` deadline and converts the breach into a
 * `MultiSigError` with code `CONFIRMATION_TIMEOUT`, so the UI can show an
 * actionable message without crashing.
 *
 * Error mapping
 * ─────────────
 * Every thrown error is converted to a `MultiSigError` with a structured
 * `MultiSigErrorCode` before propagating, giving UI code a reliable
 * discriminant to branch on.
 */

import {
  Contract,
  Transaction,
  TransactionBuilder,
  BASE_FEE,
  xdr,
} from 'stellar-sdk';
import { Horizon } from 'stellar-sdk';
import { Server, Api } from 'stellar-sdk/rpc';
import { signTransaction } from '@stellar/freighter-api';

import {
  Network,
  SOROBAN_RPC_URLS,
  NETWORK_PASSPHRASES,
  RPC_ENDPOINTS,
} from '../config';
import {
  getContractAddress,
  isPlaceholderContractAddress,
  PlaceholderContractAddressError,
} from '../../config/contracts';
import { mapContractError } from '../../app/utils/contractErrors';
import { HorizonRequestQueue } from '../utils/horizonRequestQueue';
import { useRateLimitStore } from '../store/rateLimitStore';

import type {
  MultiSigProposal,
  MultiSigObserver,
  MultiSigObserverData,
  MultiSigSimulationResult,
  MultiSigSimulationCost,
  MultiSigSimulationFootprint,
  MultiSigSigner,
  MultiSigTxState,
  MultiSigErrorCode,
  ProposeMultiSigOptions,
  SignMultiSigOptions,
  ExecuteMultiSigOptions,
  ProposeResult,
  SignResult,
  ExecuteResult,
  XlmAmount,
} from '../types/multiSig';

import {
  MultiSigError,
  stroopsToXlm,
} from '../types/multiSig';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Proposal TTL: 24 hours. */
const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;

/** How long simulation results are cached (prevents redundant RPC calls). */
const SIMULATION_CACHE_TTL_MS = 30_000;

/** Maximum confirmation polling attempts. */
const MAX_CONFIRMATION_ATTEMPTS = 60;

/** Milliseconds between confirmation polls. */
const CONFIRMATION_POLL_INTERVAL_MS = 2_000;

/** Hard deadline for the entire confirmation phase. */
const CONNECTION_TIMEOUT_MS = 120_000;

/** Base transaction fee in stroops. */
const BASE_TX_FEE_STROOPS = 100n;

// ─── Internal singletons ─────────────────────────────────────────────────────

/** Dedicated rate-limit queue for Soroban RPC calls (separate from Horizon). */
const sorobanRpcQueue = new HorizonRequestQueue(2);

/** Simulation cache keyed by `${accountAddress}:${xdrSlice}`. */
const simulationCache = new Map<
  string,
  { result: MultiSigSimulationResult; timestamp: number }
>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createSorobanServer(network: Network): Server {
  const url = SOROBAN_RPC_URLS[network];
  return new Server(url, { allowHttp: url.startsWith('http://') });
}

function getNetworkPassphrase(network: Network): string {
  return NETWORK_PASSPHRASES[network];
}

function emitObserver(
  observer: MultiSigObserver | undefined,
  state: MultiSigTxState,
  data?: MultiSigObserverData,
): void {
  if (!observer) return;
  try {
    observer(state, data);
  } catch (err) {
    console.error('[multiSigService] observer threw:', err);
  }
}

/**
 * Parse any thrown value into a human-readable string, then map it to a
 * `MultiSigErrorCode` so that callers always get a typed error.
 */
function toMultiSigError(
  thrown: unknown,
  fallbackState: MultiSigTxState,
): MultiSigError {
  // Already structured — pass through.
  if (thrown instanceof MultiSigError) return thrown;

  const mapped = mapContractError(thrown);
  const raw = thrown instanceof Error ? thrown.message : String(thrown);
  const lower = raw.toLowerCase();

  let code: MultiSigErrorCode = 'UNKNOWN';
  let userMessage = mapped.code !== 'Unknown' ? mapped.userMessage : raw;

  if (
    lower.includes('user declined') ||
    lower.includes('user rejected') ||
    lower.includes('rejected by user') ||
    lower.includes('signing failed')
  ) {
    code = 'USER_REJECTED';
    userMessage = 'Transaction signing was declined. Please try again.';
  } else if (lower.includes('network mismatch') || lower.includes('different network')) {
    code = 'NETWORK_MISMATCH';
    userMessage = 'Your wallet is connected to the wrong network. Please switch and retry.';
  } else if (lower.includes('insufficient balance') || lower.includes('insufficient_balance')) {
    code = 'INSUFFICIENT_BALANCE';
    userMessage = 'Insufficient XLM balance to cover the transaction fee.';
  } else if (lower.includes('simulation failed') || lower.includes('error in simulation')) {
    code = 'SIMULATION_FAILED';
    userMessage = 'Transaction simulation failed. Please check the contract parameters.';
  } else if (lower.includes('timeout') || lower.includes('timed out')) {
    code = 'CONFIRMATION_TIMEOUT';
    userMessage = 'Transaction confirmation timed out. Check the explorer with your hash.';
  } else if (lower.includes('rate limit') || lower.includes('429')) {
    code = 'RATE_LIMITED';
    userMessage = 'Soroban RPC rate limit reached. Please wait a moment and retry.';
  } else if (lower.includes('connection') || lower.includes('network error') || lower.includes('econnrefused')) {
    code = 'CONNECTION_TIMEOUT';
    userMessage = 'Network error. Please check your connection and try again.';
  } else if (mapped.code !== 'Unknown') {
    code = 'CONTRACT_ERROR';
  }

  return new MultiSigError(code, fallbackState, userMessage, thrown);
}

/** Generate a deterministic proposal ID from its key fields. */
function generateProposalId(
  network: Network,
  contractAddress: string,
  method: string,
  proposerAddress: string,
  timestamp: string,
): string {
  const raw = `${network}:${contractAddress}:${method}:${proposerAddress}:${timestamp}`;
  // Simple non-cryptographic hash sufficient for a client-side identifier.
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0;
  }
  return `msig-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/** Prune expired entries from the simulation cache. */
function pruneSimulationCache(): void {
  const now = Date.now();
  for (const [key, entry] of simulationCache.entries()) {
    if (now - entry.timestamp > SIMULATION_CACHE_TTL_MS) {
      simulationCache.delete(key);
    }
  }
}

function buildSimulationCacheKey(
  accountAddress: string,
  transaction: Transaction,
): string {
  try {
    const xdrStr = transaction.toXDR();
    return `${accountAddress}:${xdrStr.slice(0, 64)}`;
  } catch {
    return `${accountAddress}:${Date.now()}`;
  }
}

/**
 * Fetch the XLM balance of an account via Horizon.
 * Returns 0 if the account is not found (e.g. unfunded testnet account).
 */
async function fetchXlmBalance(
  accountAddress: string,
  network: Network,
): Promise<XlmAmount> {
  const horizonUrl = RPC_ENDPOINTS[network];
  const horizonServer = new Horizon.Server(horizonUrl);
  try {
    const account = await horizonServer.loadAccount(accountAddress);
    const nativeBalance = account.balances.find(
      (b) => b.asset_type === 'native',
    );
    return nativeBalance ? nativeBalance.balance : '0.0000000';
  } catch {
    return '0.0000000';
  }
}

/**
 * Estimate the fee from simulation cost data.
 * Returns value as stroops (bigint).
 */
function estimateFeeStroops(cost?: MultiSigSimulationCost): bigint {
  let stroops = BASE_TX_FEE_STROOPS;
  if (cost) {
    stroops += BigInt(Math.ceil(cost.cpuInsns * 0.00001));
    stroops += BigInt(Math.ceil(cost.memBytes * 0.000001));
  }
  return stroops;
}

// ─── Core simulation ─────────────────────────────────────────────────────────

/**
 * Simulate a transaction against the Soroban RPC, with caching and
 * balance validation.  All RPC calls go through `sorobanRpcQueue` to
 * respect rate limits.
 */
async function simulateTransaction(
  server: Server,
  transaction: Transaction,
  accountAddress: string,
  network: Network,
  observer: MultiSigObserver | undefined,
): Promise<MultiSigSimulationResult> {
  emitObserver(observer, 'simulating', { kind: 'simulating' });

  pruneSimulationCache();

  const cacheKey = buildSimulationCacheKey(accountAddress, transaction);
  const cached = simulationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SIMULATION_CACHE_TTL_MS) {
    emitObserver(observer, 'simulating', {
      kind: 'simulating',
      simulation: cached.result,
      cached: true,
    });
    return cached.result;
  }

  try {
    const simulation = await sorobanRpcQueue.enqueue(() =>
      server.simulateTransaction(transaction),
    );

    // stellar-sdk uses `error` field for simulation failures.
    const simAny = simulation as unknown as Record<string, unknown>;
    if ('error' in simulation || simAny.errorResult) {
      const errorPayload = simAny.errorResult ?? simAny.error ?? simulation;
      const { userMessage: errorMsg } = mapContractError(errorPayload);
      const result: MultiSigSimulationResult = { success: false, error: errorMsg };
      emitObserver(observer, 'failed', {
        kind: 'error',
        error: errorMsg,
        code: 'SIMULATION_FAILED',
      });
      return result;
    }

    // Parse cost
    const costRaw = simAny.cost as { cpuInsns?: number; memBytes?: number } | undefined;
    const cost: MultiSigSimulationCost | undefined = costRaw
      ? { cpuInsns: costRaw.cpuInsns ?? 0, memBytes: costRaw.memBytes ?? 0 }
      : undefined;

    // Parse footprint
    const fpRaw = simAny.footprint as { readOnly?: string[]; readWrite?: string[] } | undefined;
    const footprint: MultiSigSimulationFootprint | undefined = fpRaw
      ? { readOnly: fpRaw.readOnly ?? [], readWrite: fpRaw.readWrite ?? [] }
      : undefined;

    const estimatedFeeStroops = estimateFeeStroops(cost);
    const estimatedFeeXlm = stroopsToXlm(estimatedFeeStroops);

    // Validate account balance
    const balanceXlm = await fetchXlmBalance(accountAddress, network);
    const balanceStroops = BigInt(Math.round(parseFloat(balanceXlm) * 10_000_000));
    if (balanceStroops < estimatedFeeStroops) {
      const msg = `Insufficient balance. Required: ${estimatedFeeXlm} XLM, Available: ${balanceXlm} XLM`;
      const result: MultiSigSimulationResult = { success: false, error: msg };
      emitObserver(observer, 'failed', {
        kind: 'error',
        error: msg,
        code: 'INSUFFICIENT_BALANCE',
      });
      return result;
    }

    const result: MultiSigSimulationResult = {
      success: true,
      cost,
      footprint,
      estimatedFeeXlm,
      estimatedFeeStroops,
      accountBalanceXlm: balanceXlm,
      requiresRestore: !!(simAny.restorePreamble),
    };

    simulationCache.set(cacheKey, { result, timestamp: Date.now() });
    emitObserver(observer, 'simulating', { kind: 'simulating', simulation: result });
    return result;
  } catch (thrown) {
    const err = toMultiSigError(thrown, 'failed');
    emitObserver(observer, 'failed', {
      kind: 'error',
      error: err.userMessage,
      code: err.code,
    });
    // Re-surface as a simulation failure result rather than throwing, so the
    // propose flow can surface a clean error without an unhandled rejection.
    return { success: false, error: err.userMessage };
  }
}

// ─── Phase 1 — Propose ────────────────────────────────────────────────────────

/**
 * Build and simulate a multi-sig transaction, returning an unsigned proposal.
 *
 * The proposer does NOT sign at this stage — they only assemble the envelope
 * so that co-signers can review it before any key is committed.
 *
 * @throws {MultiSigError} with `code === 'SIMULATION_FAILED'` when simulation
 * returns an error, and other codes for network/config issues.
 */
export async function proposeMultiSigTransaction(
  options: ProposeMultiSigOptions,
): Promise<ProposeResult> {
  const {
    network,
    proposerAddress,
    additionalSigners,
    threshold,
    contractAddress,
    contractArgs,
    observer,
  } = options;

  emitObserver(observer, 'building');

  // ── Contract address guard ──────────────────────────────────────────────
  let resolvedContractAddress = contractAddress;
  if (!resolvedContractAddress || isPlaceholderContractAddress(resolvedContractAddress)) {
    try {
      resolvedContractAddress = getContractAddress(network);
    } catch (err) {
      if (err instanceof PlaceholderContractAddressError) {
        throw new MultiSigError(
          'CONTRACT_ERROR',
          'failed',
          `${err.userMessage} ${err.developerHint}`,
          err,
        );
      }
      throw toMultiSigError(err, 'failed');
    }
  }

  // ── Load proposer account ────────────────────────────────────────────────
  const server = createSorobanServer(network);
  let account;
  try {
    account = await sorobanRpcQueue.enqueue(() =>
      server.getAccount(proposerAddress),
    );
  } catch (thrown) {
    const msg = thrown instanceof Error ? thrown.message : String(thrown);
    const isNotFound = msg.includes('Not Found') || msg.includes('404');
    throw new MultiSigError(
      'UNKNOWN',
      'failed',
      isNotFound
        ? `Account ${proposerAddress} not found on ${network}. Ensure it is funded.`
        : `Failed to load account: ${msg}`,
      thrown,
    );
  }

  // ── Build operation ──────────────────────────────────────────────────────
  const contract = new Contract(resolvedContractAddress);

  // Build ScVal args by mapping the generic params through the contract method.
  // For a generic multi-sig we accept pre-built xdr.ScVal[] via a hidden key
  // `_scvals`; otherwise we encode string/number params as ScvString/ScvU64.
  const scArgs = buildScArgs(contractArgs.params);

  const operation = contract.call(contractArgs.method, ...scArgs);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(network),
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  // ── Simulate ─────────────────────────────────────────────────────────────
  const simulationResult = await simulateTransaction(
    server,
    transaction,
    proposerAddress,
    network,
    observer,
  );

  if (!simulationResult.success) {
    throw new MultiSigError(
      'SIMULATION_FAILED',
      'failed',
      simulationResult.error ?? 'Simulation failed',
    );
  }

  // ── Assemble proposal ────────────────────────────────────────────────────
  const proposedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MS).toISOString();

  const allSigners: string[] = [proposerAddress, ...additionalSigners].filter(
    (k, i, arr) => arr.indexOf(k) === i,   // deduplicate
  );

  const signers: MultiSigSigner[] = allSigners.map((publicKey) => ({
    publicKey,
    hasSigned: false,
    signedAt: null,
  }));

  const effectiveThreshold =
    threshold !== undefined
      ? Math.min(threshold, allSigners.length)
      : allSigners.length;

  const unsignedXdr = transaction.toXDR();

  const proposal: MultiSigProposal = {
    id: generateProposalId(
      network,
      resolvedContractAddress,
      contractArgs.method,
      proposerAddress,
      proposedAt,
    ),
    network,
    contractAddress: resolvedContractAddress,
    contractArgs,
    unsignedXdr,
    assembledXdr: unsignedXdr,
    signers,
    threshold: effectiveThreshold,
    proposedBy: proposerAddress,
    proposedAt,
    expiresAt,
    simulationResult,
    state: 'proposed',
    transactionHash: null,
    confirmedLedger: null,
  };

  emitObserver(observer, 'proposed');

  return { proposal };
}

// ─── Phase 2 — Sign ───────────────────────────────────────────────────────────

/**
 * Apply a signer's Freighter authorisation to the assembled XDR.
 *
 * Uses `signTransaction` from `@stellar/freighter-api`.  If the user
 * declines, the error is mapped to code `USER_REJECTED`.
 *
 * @throws {MultiSigError} with `code === 'USER_REJECTED'` when the user
 * cancels the Freighter signing dialog.
 * @throws {MultiSigError} with `code === 'ALREADY_SIGNED'` if the signer
 * has already contributed a signature.
 * @throws {MultiSigError} with `code === 'NOT_AUTHORISED'` if the key is
 * not in the proposal's signer list.
 * @throws {MultiSigError} with `code === 'PROPOSAL_EXPIRED'` if the TTL
 * has elapsed.
 */
export async function signMultiSigProposal(
  options: SignMultiSigOptions,
): Promise<SignResult> {
  const { proposal, signerAddress, observer } = options;

  // ── Guard: expiry ────────────────────────────────────────────────────────
  if (Date.now() > new Date(proposal.expiresAt).getTime()) {
    throw new MultiSigError(
      'PROPOSAL_EXPIRED',
      'failed',
      'This proposal has expired. Please create a new one.',
    );
  }

  // ── Guard: authorised signer ─────────────────────────────────────────────
  const signerEntry = proposal.signers.find((s) => s.publicKey === signerAddress);
  if (!signerEntry) {
    throw new MultiSigError(
      'NOT_AUTHORISED',
      'failed',
      `${signerAddress.slice(0, 8)}… is not in the authorised signer list.`,
    );
  }

  // ── Guard: already signed ────────────────────────────────────────────────
  if (signerEntry.hasSigned) {
    throw new MultiSigError(
      'ALREADY_SIGNED',
      'failed',
      `${signerAddress.slice(0, 8)}… has already signed this proposal.`,
    );
  }

  emitObserver(observer, 'signing', { kind: 'signing', signerAddress });

  // ── Freighter signing ────────────────────────────────────────────────────
  let signedXdr: string;
  try {
    const result = await signTransaction(proposal.assembledXdr, {
      networkPassphrase: getNetworkPassphrase(proposal.network),
    });

    if (result.error) {
      const lower = (result.error as string).toLowerCase();
      const isRejection =
        lower.includes('user declined') ||
        lower.includes('user rejected') ||
        lower.includes('rejected by user');

      throw new MultiSigError(
        isRejection ? 'USER_REJECTED' : 'UNKNOWN',
        'rejected',
        isRejection
          ? 'Transaction signing was declined. Please try again.'
          : `Signing failed: ${result.error as string}`,
      );
    }

    if (!result.signedTxXdr) {
      throw new MultiSigError(
        'UNKNOWN',
        'failed',
        'Freighter returned an empty signed transaction.',
      );
    }

    signedXdr = result.signedTxXdr;
  } catch (thrown) {
    if (thrown instanceof MultiSigError) {
      emitObserver(observer, thrown.state, {
        kind: 'error',
        error: thrown.userMessage,
        code: thrown.code,
      });
      throw thrown;
    }
    const err = toMultiSigError(thrown, 'rejected');
    emitObserver(observer, err.state, {
      kind: 'error',
      error: err.userMessage,
      code: err.code,
    });
    throw err;
  }

  // ── Update proposal ──────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const updatedSigners: MultiSigSigner[] = proposal.signers.map((s) =>
    s.publicKey === signerAddress
      ? { ...s, hasSigned: true, signedAt: now }
      : s,
  );

  const signedCount = updatedSigners.filter((s) => s.hasSigned).length;
  const thresholdMet = signedCount >= proposal.threshold;

  const updatedProposal: MultiSigProposal = {
    ...proposal,
    signers: updatedSigners,
    assembledXdr: signedXdr,
    state: thresholdMet ? 'ready' : 'signed',
  };

  emitObserver(observer, updatedProposal.state);

  return { proposal: updatedProposal, thresholdMet };
}

// ─── Phase 3 — Execute ────────────────────────────────────────────────────────

/**
 * Submit the fully-authorised XDR envelope to Soroban RPC and poll for
 * ledger confirmation.  The entire operation races against
 * `CONNECTION_TIMEOUT_MS` to prevent the UI hanging indefinitely.
 *
 * @throws {MultiSigError} with `code === 'THRESHOLD_NOT_MET'` if the
 * required signers have not all signed yet.
 * @throws {MultiSigError} with `code === 'CONFIRMATION_TIMEOUT'` if
 * polling exceeds the deadline.
 */
export async function executeMultiSigProposal(
  options: ExecuteMultiSigOptions,
): Promise<ExecuteResult> {
  const { proposal, observer } = options;

  // ── Guard: threshold ─────────────────────────────────────────────────────
  const signedCount = proposal.signers.filter((s) => s.hasSigned).length;
  if (signedCount < proposal.threshold) {
    throw new MultiSigError(
      'THRESHOLD_NOT_MET',
      'failed',
      `Only ${signedCount} of ${proposal.threshold} required signatures collected.`,
    );
  }

  // ── Guard: expiry ────────────────────────────────────────────────────────
  if (Date.now() > new Date(proposal.expiresAt).getTime()) {
    throw new MultiSigError(
      'PROPOSAL_EXPIRED',
      'failed',
      'This proposal has expired. Please create a new one.',
    );
  }

  const server = createSorobanServer(proposal.network);
  const startTime = Date.now();

  // Wrap the whole execution in a timeout race.
  const executionPromise = executeInternal(server, proposal, observer, startTime);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new MultiSigError(
            'CONFIRMATION_TIMEOUT',
            'timeout',
            'Transaction confirmation timed out. Check the explorer with your hash.',
          ),
        ),
      CONNECTION_TIMEOUT_MS,
    ),
  );

  try {
    return await Promise.race([executionPromise, timeoutPromise]);
  } catch (thrown) {
    const err = thrown instanceof MultiSigError
      ? thrown
      : toMultiSigError(thrown, 'failed');

    emitObserver(observer, err.state as MultiSigTxState, {
      kind: 'error',
      error: err.userMessage,
      code: err.code,
    });

    // Surface rate-limit info to the global store so the banner appears.
    if (err.code === 'RATE_LIMITED') {
      useRateLimitStore.getState().setRateLimited(true, Date.now() + 60_000);
      useRateLimitStore.getState().setMessage(err.userMessage);
    }

    throw err;
  }
}

async function executeInternal(
  server: Server,
  proposal: MultiSigProposal,
  observer: MultiSigObserver | undefined,
  startTime: number,
): Promise<ExecuteResult> {
  emitObserver(observer, 'submitting');

  // ── Submit ───────────────────────────────────────────────────────────────
  let transactionHash: string;
  try {
    const envelope = xdr.TransactionEnvelope.fromXDR(proposal.assembledXdr, 'base64');
    const signedTx = TransactionBuilder.fromXDR(
      envelope.toXDR('base64'),
      '*', // passphrase embedded in XDR; we only re-submit
    ) as Transaction;

    const response = await sorobanRpcQueue.enqueue(() =>
      server.sendTransaction(signedTx),
    );

    if (response.errorResult) {
      const { userMessage } = mapContractError(response.errorResult);
      throw new MultiSigError('SUBMISSION_FAILED', 'failed', userMessage);
    }

    transactionHash = response.hash;
  } catch (thrown) {
    throw thrown instanceof MultiSigError
      ? thrown
      : toMultiSigError(thrown, 'failed');
  }

  emitObserver(observer, 'submitted');

  // ── Poll for confirmation ────────────────────────────────────────────────
  let attempts = 0;

  while (attempts < MAX_CONFIRMATION_ATTEMPTS) {
    const elapsedMs = Date.now() - startTime;

    emitObserver(observer, 'confirming', {
      kind: 'confirming',
      attempt: attempts + 1,
      maxAttempts: MAX_CONFIRMATION_ATTEMPTS,
      elapsedMs,
      transactionHash,
    });

    try {
      const response = await sorobanRpcQueue.enqueue(() =>
        server.getTransaction(transactionHash),
      );

      if (response.status === Api.GetTransactionStatus.SUCCESS) {
        const ledger = response.ledger ?? 0;
        emitObserver(observer, 'confirmed', {
          kind: 'success',
          transactionHash,
          ledger,
        });
        useRateLimitStore.getState().reset();
        return { transactionHash, ledger };
      }

      if (response.status === Api.GetTransactionStatus.FAILED) {
        throw new MultiSigError(
          'SUBMISSION_FAILED',
          'failed',
          'Transaction was rejected by the ledger.',
        );
      }
      // NOT_FOUND or PENDING — keep polling.
    } catch (thrown) {
      if (thrown instanceof MultiSigError) throw thrown;
      // Transient polling error; log and retry.
      console.warn(`[multiSigService] poll attempt ${attempts + 1} failed:`, thrown);
    }

    attempts++;
    await new Promise((resolve) =>
      setTimeout(resolve, CONFIRMATION_POLL_INTERVAL_MS),
    );
  }

  throw new MultiSigError(
    'CONFIRMATION_TIMEOUT',
    'timeout',
    `Transaction not confirmed after ${MAX_CONFIRMATION_ATTEMPTS} attempts. ` +
      'Check the explorer with your transaction hash.',
  );
}

// ─── ScVal helpers ────────────────────────────────────────────────────────────

/**
 * Build a minimal set of ScVal arguments from a plain params object.
 *
 * Callers that need precise type control should pre-encode their params as
 * `xdr.ScVal[]` and pass them under the special key `_scvals` — this
 * function will return them unchanged.
 *
 * Otherwise, types are inferred:
 *   - `xdr.ScVal` instances → passed through.
 *   - `Uint8Array`          → scvBytes
 *   - `boolean`             → scvBool
 *   - `bigint`              → scvU64
 *   - `number` (integer ≤ 4_294_967_295) → scvU32
 *   - `number` (other)      → scvU64 (converted via BigInt)
 *   - `string`              → scvString
 */
function buildScArgs(params: Record<string, unknown>): xdr.ScVal[] {
  // Fast path: caller provided pre-built ScVal array.
  if (Array.isArray(params._scvals)) {
    return params._scvals as xdr.ScVal[];
  }

  return Object.values(params).map((value): xdr.ScVal => {
    if (value instanceof xdr.ScVal) return value;

    if (value instanceof Uint8Array) {
      return xdr.ScVal.scvBytes(Buffer.from(value));
    }

    if (typeof value === 'boolean') {
      return xdr.ScVal.scvBool(value);
    }

    if (typeof value === 'bigint') {
      const hi = BigInt.asUintN(64, value >> 32n);
      const lo = BigInt.asUintN(32, value);
      return xdr.ScVal.scvU64(
        new xdr.Uint64(Number(lo), Number(hi)),
      );
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff) {
        return xdr.ScVal.scvU32(value);
      }
      const big = BigInt(Math.round(value));
      const hi = Number(BigInt.asUintN(64, big >> 32n));
      const lo = Number(BigInt.asUintN(32, big));
      return xdr.ScVal.scvU64(new xdr.Uint64(lo, hi));
    }

    if (typeof value === 'string') {
      return xdr.ScVal.scvString(value);
    }

    // Fallback: encode as JSON string so the call doesn't crash.
    return xdr.ScVal.scvString(JSON.stringify(value));
  });
}

// ─── Utility exports ──────────────────────────────────────────────────────────

/**
 * Manually clear the simulation cache.  Call this after an account balance
 * change or when switching networks.
 */
export function clearMultiSigSimulationCache(): void {
  simulationCache.clear();
}

/**
 * Count signed parties on a proposal.
 */
export function countSignatures(proposal: MultiSigProposal): number {
  return proposal.signers.filter((s) => s.hasSigned).length;
}

/**
 * Check whether a proposal has met its signing threshold.
 */
export function isThresholdMet(proposal: MultiSigProposal): boolean {
  return countSignatures(proposal) >= proposal.threshold;
}

/**
 * Check whether a proposal has passed its expiry date.
 */
export function isProposalExpired(proposal: MultiSigProposal): boolean {
  return Date.now() > new Date(proposal.expiresAt).getTime();
}
