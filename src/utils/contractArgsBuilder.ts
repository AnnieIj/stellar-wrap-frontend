/**
 * Contract Arguments Builder
 *
 * Converts indexed stats and account addresses into properly typed
 * ScVal arguments ready for Soroban contract invocation.
 *
 * This module bridges the gap between JavaScript data (from API responses
 * and frontend state) and the ScVal types required by Soroban contracts.
 *
 * @module contractArgsBuilder
 */

import { xdr, SorobanRpc, Contract, TransactionBuilder, Networks, BASE_FEE } from "stellar-sdk";
import { isAllowed, getPublicKey, signTransaction as freighterSignTransaction } from "@stellar/freighter-api";
import {
  toScVal,
  addressToScVal,
  objectToScValMap,
  isConversionError,
  type ConversionResult,
  type ScValTargetType,
} from "./sorobanConverter";

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Validated contract arguments ready for invocation.
 */
export interface ContractArgs {
  args: xdr.ScVal[];
  /** Human-readable description of each argument for debugging */
  argDescriptions: string[];
}

/**
 * Result of building contract arguments.
 */
export type BuildArgsResult =
  | { success: true; data: ContractArgs }
  | { success: false; errors: string[] };

/**
 * Extended stats with optional timeframe for contract submission.
 */
export interface ContractStatsInput {
  totalVolume: number;
  mostActiveAsset: string;
  contractCalls: number;
  timeframe?: string;
  /** Additional key-value pairs to include */
  [key: string]: unknown;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Unwrap a ConversionResult, pushing any error into the errors array
 * and returning the ScVal on success (or null on failure).
 */
function unwrap(
  result: ConversionResult,
  label: string,
  errors: string[],
): xdr.ScVal | null {
  if (isConversionError(result)) {
    errors.push(`${label}: ${result.error}`);
    return null;
  }
  return result.value;
}

const STROOPS_PER_XLM = 10_000_000n;
const RPC_MIN_INTERVAL_MS = 100;
let lastRpcCallTimestamp = 0;

/**
 * Parses a Stellar amount into stroops as a BigInt for i128 ScVal values.
 */
export function parseStellarAmount(amount: string | number): bigint | null {
  const raw = typeof amount === "number" ? amount.toFixed(7) : amount.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction.padEnd(7, "0"));
}

/**
 * Formats a stroop value back into a human-readable Stellar amount string.
 */
export function formatStellarAmount(stroops: bigint | number | string): string {
  const asBigInt = BigInt(stroops);
  const negative = asBigInt < 0n;
  const abs = negative ? -asBigInt : asBigInt;
  const whole = abs / STROOPS_PER_XLM;
  const fraction = abs % STROOPS_PER_XLM;
  const formatted = `${whole.toString()}.${fraction.toString().padStart(7, "0").replace(/0+$/, "")}`;
  return `${negative ? "-" : ""}${formatted.replace(/\.$/, "")}`;
}

async function throttledRpcCall<T>(rpcCall: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const wait = Math.max(0, RPC_MIN_INTERVAL_MS - (now - lastRpcCallTimestamp));
  lastRpcCallTimestamp = now + wait;
  if (wait > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, wait));
  }
  return rpcCall();
}

export async function getFreighterPublicKey(): Promise<string> {
  try {
    if (!(await isAllowed())) {
      throw new Error("Freighter is not connected.");
    }
    return await getPublicKey();
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Freighter is not available";
    throw new Error(`Unable to connect to Freighter: ${reason}`);
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validates the indexed stats before attempting conversion.
 * Returns an array of error messages (empty if valid).
 */
export function validateIndexedStats(stats: ContractStatsInput): string[] {
  const errors: string[] = [];

  if (stats === null || stats === undefined || typeof stats !== "object") {
    return ["Stats must be a non-null object"];
  }

  // totalVolume validation
  if (typeof stats.totalVolume !== "number") {
    errors.push(
      `totalVolume must be a number, got ${typeof stats.totalVolume}`,
    );
  } else if (stats.totalVolume < 0) {
    errors.push(`totalVolume must be non-negative, got ${stats.totalVolume}`);
  } else if (!Number.isFinite(stats.totalVolume)) {
    errors.push("totalVolume must be a finite number");
  }

  // mostActiveAsset validation
  if (typeof stats.mostActiveAsset !== "string") {
    errors.push(
      `mostActiveAsset must be a string, got ${typeof stats.mostActiveAsset}`,
    );
  } else if (stats.mostActiveAsset.trim().length === 0) {
    errors.push("mostActiveAsset must not be empty");
  }

  // contractCalls validation
  if (typeof stats.contractCalls !== "number") {
    errors.push(
      `contractCalls must be a number, got ${typeof stats.contractCalls}`,
    );
  } else if (!Number.isInteger(stats.contractCalls)) {
    errors.push(`contractCalls must be an integer, got ${stats.contractCalls}`);
  } else if (stats.contractCalls < 0) {
    errors.push(
      `contractCalls must be non-negative, got ${stats.contractCalls}`,
    );
  }

  // timeframe validation (optional)
  if (stats.timeframe !== undefined && typeof stats.timeframe !== "string") {
    errors.push(
      `timeframe must be a string if provided, got ${typeof stats.timeframe}`,
    );
  }

  return errors;
}

// ─── Argument Builders ──────────────────────────────────────────────────────

/**
 * Builds an ordered array of ScVal contract arguments from indexed stats
 * and an account address.
 *
 * Argument order (matching contract function signature):
 *   0: accountAddress → ScVal.scvAddress
 *   1: totalVolume    → ScVal.scvI128 (stroops)
 *   2: mostActiveAsset→ ScVal.scvString
 *   3: contractCalls  → ScVal.scvU32
 *   4: timeframe      → ScVal.scvString (optional, defaults to "all")
 *
 * @param stats - The indexed stats to convert
 * @param accountAddress - The Stellar account address (G... or C...)
 * @returns BuildArgsResult with the arguments or validation errors
 *
 * @example
 * ```ts
 * const result = buildContractArgs(
 *   { totalVolume: 45000, mostActiveAsset: 'XLM', contractCalls: 120 },
 *   'GABC...XYZ'
 * );
 *
 * if (result.success) {
 *   // Use result.data.args in contract invocation
 *   contract.call('submit_stats', ...result.data.args);
 * } else {
 *   console.error('Build failed:', result.errors);
 * }
 * ```
 */
export function buildContractArgs(
  stats: ContractStatsInput,
  accountAddress: string,
): BuildArgsResult {
  // 1. Validate input
  const validationErrors = validateIndexedStats(stats);
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  const errors: string[] = [];
  const args: xdr.ScVal[] = [];
  const argDescriptions: string[] = [];

  // 2. Convert account address → ScVal.scvAddress
  const addrVal = unwrap(
    addressToScVal(accountAddress),
    "accountAddress",
    errors,
  );
  if (addrVal) {
    args.push(addrVal);
    argDescriptions.push(`accountAddress: ${accountAddress}`);
  }

  // 3. Convert totalVolume → ScVal.scvI128 (in stroops)
  const totalVolumeStroops = parseStellarAmount(stats.totalVolume);
  if (totalVolumeStroops === null) {
    errors.push(
      "totalVolume must be a valid Stellar amount with at most 7 decimal places",
    );
  } else {
    const volumeVal = unwrap(
      toScVal(totalVolumeStroops, "i128"),
      "totalVolume",
      errors,
    );
    if (volumeVal) {
      args.push(volumeVal);
      argDescriptions.push(
        `totalVolume: ${stats.totalVolume} (i128 stroops, ${totalVolumeStroops})`,
      );
    }
  }

  // 4. Convert mostActiveAsset → ScVal.scvString
  const assetVal = unwrap(
    toScVal(stats.mostActiveAsset, "string"),
    "mostActiveAsset",
    errors,
  );
  if (assetVal) {
    args.push(assetVal);
    argDescriptions.push(
      `mostActiveAsset: "${stats.mostActiveAsset}" (string)`,
    );
  }

  // 5. Convert contractCalls → ScVal.scvU32
  const callsVal = unwrap(
    toScVal(stats.contractCalls, "u32"),
    "contractCalls",
    errors,
  );
  if (callsVal) {
    args.push(callsVal);
    argDescriptions.push(`contractCalls: ${stats.contractCalls} (u32)`);
  }

  // 6. Convert timeframe → ScVal.scvString  (optional, default "all")
  const timeframe = stats.timeframe ?? "all";
  const timeframeVal = unwrap(
    toScVal(timeframe, "string"),
    "timeframe",
    errors,
  );
  if (timeframeVal) {
    args.push(timeframeVal);
    argDescriptions.push(`timeframe: "${timeframe}" (string)`);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { args, argDescriptions },
  };
}

/**
 * Builds contract arguments where the stats are passed as a single
 * ScVal map instead of individual arguments.
 *
 * This is useful for contracts that accept a single map parameter
 * containing all statistics.
 *
 * Argument order:
 *   0: accountAddress → ScVal.scvAddress
 *   1: statsMap       → ScVal.scvMap({...})
 *
 * @param stats - The indexed stats to convert
 * @param accountAddress - The Stellar account address
 * @returns BuildArgsResult with the arguments or errors
 */
export function buildContractArgsAsMap(
  stats: ContractStatsInput,
  accountAddress: string,
): BuildArgsResult {
  // Validate
  const validationErrors = validateIndexedStats(stats);
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  const errors: string[] = [];
  const args: xdr.ScVal[] = [];
  const argDescriptions: string[] = [];

  // 1. Account address
  const addrVal = unwrap(
    addressToScVal(accountAddress),
    "accountAddress",
    errors,
  );
  if (addrVal) {
    args.push(addrVal);
    argDescriptions.push(`accountAddress: ${accountAddress}`);
  }

  // 2. Stats as a map
  const totalVolumeStroops = parseStellarAmount(stats.totalVolume);
  if (totalVolumeStroops === null) {
    errors.push(
      "totalVolume must be a valid Stellar amount with at most 7 decimal places",
    );
  }
  const statsForMap: Record<string, unknown> = {
    total_volume: totalVolumeStroops ?? stats.totalVolume,
    most_active_asset: stats.mostActiveAsset,
    contract_calls: stats.contractCalls,
  };
  if (stats.timeframe) {
    statsForMap.timeframe = stats.timeframe;
  }

  const typeHints: Record<string, ScValTargetType> = {
    total_volume: "i128",
    most_active_asset: "string",
    contract_calls: "u32",
    timeframe: "string",
  };

  const mapVal = unwrap(
    objectToScValMap(statsForMap, typeHints),
    "statsMap",
    errors,
  );
  if (mapVal) {
    args.push(mapVal);
    argDescriptions.push(
      "statsMap: { total_volume, most_active_asset, contract_calls }",
    );
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { args, argDescriptions },
  };
}
// ─── Soroban RPC Execution ──────────────────────────────────────────────────
export interface SorobanInvokeOptions {
  rpcUrl: string;
  publicKey?: string;
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  networkPassphrase?: string;
  timeoutMs?: number;
}

export interface SorobanInvokeResult {
  hash: string;
  status: string;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Polls the Soroban RPC server until a submitted transaction reaches a
 * terminal state or the deadline expires.
 */
async function waitForSorobanTransaction(
  server: SorobanRpc.Server,
  hash: string,
  timeoutMs: number,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let delayMs = 500;

  while (Date.now() < deadline) {
    const response = await withTimeout(
      throttledRpcCall(() => server.getTransaction(hash)),
      Math.min(timeoutMs, 10_000),
      "Fetching transaction status",
    );

    if (response.status === "SUCCESS") {
      return response.status;
    }

    if (response.status === "FAILED") {
      throw new Error(`Soroban transaction failed: ${hash}`);
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      break;
    }

    await new Promise<void>((resolve) =>
      setTimeout(resolve, Math.min(delayMs, remainingMs)),
    );
    delayMs = Math.min(delayMs * 2, 5_000);
  }

  throw new Error(
    `Timed out waiting for transaction ${hash} after ${timeoutMs}ms`,
  );
}

export async function invokeSorobanContract(
  options: SorobanInvokeOptions,
): Promise<SorobanInvokeResult> {
  const {
    rpcUrl,
    publicKey,
    contractId,
    method,
    args,
    networkPassphrase = Networks.TESTNET,
    timeoutMs = 30_000,
  } = options;

  const resolvedPublicKey = publicKey ?? (await getFreighterPublicKey());
  const server = new SorobanRpc.Server(rpcUrl, { allowHttp: true });
  const source = await withTimeout(
    throttledRpcCall(() => server.getAccount(resolvedPublicKey)),
    timeoutMs,
    "Fetching account",
  );

  const contract = new Contract(contractId);
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(0)
    .build();

  const simulation = await withTimeout(
    throttledRpcCall(() => server.simulateTransaction(transaction)),
    timeoutMs,
    "Simulating transaction",
  );

  if ("error" in simulation && typeof simulation.error === "string") {
    throw new Error(`Soroban simulation failed: ${simulation.error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(
    simulation,
    networkPassphrase,
  ).build();

  let signedXdr: string;
  try {
    signedXdr = await withTimeout(
      freighterSignTransaction(prepared.toXDR(), {
        networkPassphrase,
      }),
      timeoutMs,
      "Signing transaction",
    );
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error";
    throw new Error(`Transaction signature was rejected. ${reason}`);
  }

  const signedTransaction = TransactionBuilder.fromXDR(
    signedXdr,
    networkPassphrase,
  );

  const response = await withTimeout(
    throttledRpcCall(() => server.sendTransaction(signedTransaction)),
    timeoutMs,
    "Sending transaction",
  );

  if (response.status === "PENDING" || response.status === "DUPLICATE") {
    const finalStatus = await waitForSorobanTransaction(
      server,
      response.hash,
      timeoutMs,
    );

    return {
      hash: response.hash,
      status: finalStatus,
    };
  }

  if (response.status === "ERROR") {
    throw new Error(`Soroban send transaction failed: ${response.hash}`);
  }

  return {
    hash: response.hash,
    status: response.status,
  };
}

/**
 * Logs contract arguments in a human-readable format for debugging.
 *
 * @param result - The build result to log
 * @param label  - Optional label for the log group
 */
export function logContractArgs(
  result: BuildArgsResult,
  label = "Contract Arguments",
): void {
  if (result.success === true) {
    console.group(`✅ ${label}`);
    result.data.argDescriptions.forEach((desc, i) => {
      console.log(`  [${i}] ${desc}`);
    });
    console.log(`  Total arguments: ${result.data.args.length}`);
    console.groupEnd();
  }
  if (result.success === false) {
    console.group(`❌ ${label} - Build Failed`);
    result.errors.forEach((err) => {
      console.error(`  • ${err}`);
    });
    console.groupEnd();
  }
}
// ─── mint_wrap Argument Builder ─────────────────────────────────────────────

/**
 * Input required to build arguments for the `mint_wrap` contract call.
 *
 * IMPORTANT: `dataHash` and `signature` must be produced by a trusted
 * backend/attestation service that hashes the verified stats payload and
 * signs it server-side. This builder does NOT compute or fabricate them —
 * without server-side signing, any client could mint an arbitrary
 * archetype/period for itself. See PR notes for the outstanding backend
 * work this depends on.
 */
export interface MintWrapArgsInput {
  accountAddress: string;
  period: string;
  archetype: string;
  dataHash: Uint8Array;
  signature: Uint8Array;
}

/**
 * Validates input before building mint_wrap ScVal args.
 */
export function validateMintWrapInput(input: MintWrapArgsInput): string[] {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return ["Mint wrap input must be a non-null object"];
  }

  if (
    typeof input.accountAddress !== "string" ||
    input.accountAddress.trim().length === 0
  ) {
    errors.push("accountAddress must be a non-empty string");
  }

  if (typeof input.period !== "string" || input.period.trim().length === 0) {
    errors.push(
      'period must be a non-empty string (e.g. "weekly", "monthly", "yearly")',
    );
  }

  if (
    typeof input.archetype !== "string" ||
    input.archetype.trim().length === 0
  ) {
    errors.push("archetype must be a non-empty string (the persona label)");
  }

  if (!(input.dataHash instanceof Uint8Array) || input.dataHash.length === 0) {
    errors.push(
      "dataHash must be a non-empty byte array produced by the backend signing service",
    );
  }

  if (
    !(input.signature instanceof Uint8Array) ||
    input.signature.length === 0
  ) {
    errors.push(
      "signature must be a non-empty byte array produced by the backend signing service",
    );
  }

  return errors;
}

/**
 * Builds ordered ScVal arguments for the `mint_wrap` contract function.
 *
 * Argument order (matches deployed contract signature):
 *   0: user      → ScVal.scvAddress
 *   1: period    → ScVal.scvString
 *   2: archetype → ScVal.scvString
 *   3: data_hash → ScVal.scvBytes
 *   4: signature → ScVal.scvBytes
 *
 * @example
 * ```ts
 * const result = buildMintWrapArgs({
 *   accountAddress: 'GABC...XYZ',
 *   period: 'monthly',
 *   archetype: 'The DeFi Patron',
 *   dataHash: attestation.dataHash,
 *   signature: attestation.signature,
 * });
 *
 * if (result.success) {
 *   contract.call('mint_wrap', ...result.data.args);
 * }
 * ```
 */
export function buildMintWrapArgs(input: MintWrapArgsInput): BuildArgsResult {
  const validationErrors = validateMintWrapInput(input);
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }

  const errors: string[] = [];
  const args: xdr.ScVal[] = [];
  const argDescriptions: string[] = [];

  const userVal = unwrap(addressToScVal(input.accountAddress), "user", errors);
  if (userVal) {
    args.push(userVal);
    argDescriptions.push(`user: ${input.accountAddress}`);
  }

  const periodVal = unwrap(toScVal(input.period, "string"), "period", errors);
  if (periodVal) {
    args.push(periodVal);
    argDescriptions.push(`period: "${input.period}" (string)`);
  }

  const archetypeVal = unwrap(
    toScVal(input.archetype, "string"),
    "archetype",
    errors,
  );
  if (archetypeVal) {
    args.push(archetypeVal);
    argDescriptions.push(`archetype: "${input.archetype}" (string)`);
  }

  const dataHashVal = unwrap(
    toScVal(input.dataHash, "bytes"),
    "data_hash",
    errors,
  );
  if (dataHashVal) {
    args.push(dataHashVal);
    argDescriptions.push(`data_hash: <${input.dataHash.length} bytes>`);
  }

  const signatureVal = unwrap(
    toScVal(input.signature, "bytes"),
    "signature",
    errors,
  );
  if (signatureVal) {
    args.push(signatureVal);
    argDescriptions.push(`signature: <${input.signature.length} bytes>`);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { args, argDescriptions },
  };
}