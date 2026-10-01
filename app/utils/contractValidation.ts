/**
 * On-network contract validation using Soroban RPC.
 * Verifies contract exists and is deployed; optional mint function check.
 */

import { Network, SOROBAN_RPC_URLS, isValidNetwork } from "../../src/config";
import { getContractAddress } from "../../src/config/contracts";
import {
  ContractNotFoundError,
  ContractValidationError,
} from "./contractErrors";
import {
  BASE_FEE,
  Networks,
  Operation,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
} from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import { getPublicKey, isConnected, signTransaction } from "@stellar/freighter-api";

/** Result of validating a contract on a network */
export interface ContractValidationResult {
  exists: boolean;
  deployed: boolean;
  error?: string;
}

/** Parameters for interacting with a Soroban contract via RPC */
export interface SorobanContractCallParams {
  network: Network;
  method: string;
  args: unknown[];
  fee?: string;
  timeoutMs?: number;
  publicKey?: string;
}

/** Result of a simulated contract call */
export interface SimulationResult {
  xdr: string;
  simulationResults: unknown;
  publicKey: string;
  networkPassphrase: string;
}

/** Result of a sent contract call */
export interface ContractCallResult {
  hash: string;
  result: unknown;
}

const validationCache = new Map<Network, Promise<ContractValidationResult>>();
const serverCache = new Map<Network, Promise<Server>>();

/**
 * Wait for a promise to settle within a timeout, rejecting with a clear error.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage?: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage ?? `Operation timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** Simple delay helper. */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a Soroban RPC server instance for the given network.
 */
async function getServer(network: Network): Promise<Server> {
  if (!isValidNetwork(network)) {
    throw new ContractValidationError(`Invalid network: ${network}`, network);
  }
  const rpcUrl = SOROBAN_RPC_URLS[network];
  const cached = serverCache.get(network);
  if (cached) {
    return cached;
  }
  const { Server } = await import("stellar-sdk/rpc");
  const server = new Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
  serverCache.set(network, Promise.resolve(server));
  return server;
}

/**
 * Connect to Freighter and return the selected public key.
 * @throws Error if Freighter is unavailable or no account is selected.
 */
export async function connectFreighter(): Promise<string> {
  try {
    const connected = await isConnected();
    if (!connected) {
      throw new Error("Freighter is not connected or unlocked.");
    }
    const publicKey = await getPublicKey();
    if (!publicKey) {
      throw new Error("Freighter returned an empty public key.");
    }
    return publicKey;
  } catch (err) {
    throw new Error(
      `Failed to connect to Freighter: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Convert a Stellar amount string to stroops (1 stroop = 10--7 token).
 * Preserves precision by using BigInt.
 */
export function toStroops(amount: string | number): string {
  const amountStr = typeof amount === "number" ? amount.toFixed(7) : amount;
  const negative = amountStr.startsWith("-");
  const normalized = negative ? amountStr.slice(1) : amountStr;
  if (!/^\d+(\.\d{1,7})?$/.test(normalized)) {
    throw new Error(`Invalid amount '${amountStr}'. Maximum 7 decimal places are supported.`);
  }
  const [wholePart, fractionPart = ""] = normalized.split(".");
  const paddedFraction = fractionPart.padEnd(7, "0");
  const value = (BigInt(wholePart) * 10000000n) + BigInt(paddedFraction);
  return (negative ? -value : value).toString();
}

/**
 * Convert stroops to a human-readable Stellar amount string.
 */
export function fromStroops(stroops: string | bigint): string {
  const value = BigInt(stroops);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 10000000n;
  const fraction = abs % 10000000n;
  if (fraction === 0n) return `${negative ? "-" : ""}${whole.toString()}`;
  const fractionStr = fraction.toString().padStart(7, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}.${fractionStr}`;
}

/**
 * Poll for a submitted transaction result until it succeeds, fails, or times out.
 */
async function pollForTransaction(
  server: Server,
  hash: string,
  timeoutMs: number
): Promise<ContractCallResult> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = await withTimeout(
      server.getTransaction(hash),
      Math.min(10000, timeoutMs - (Date.now() - start)),
      `Fetching transaction status timed out`
    );
    if (response.status === "SUCCESS") {
      return { hash, result: response };
    }
    if (response.status === "FAILED") {
      throw new Error(`Transaction ${hash} failed on the network`);
    }
    const elapsed = Date.now() - start;
    if (elapsed + 1000 < timeoutMs) {
      await delay(1000);
    } else {
      break;
    }
  }
  throw new Error(`Transaction ${hash} timed out after ${timeoutMs}ms`);
}

/**
 * Verify the configured contract exists on the given network (Soroban RPC).
 * Uses getContractWasmByContractId; if it resolves, the contract is deployed.
 *
 * @param network - 'mainnet' | 'testnet'
 * @returns Promise that resolves if contract exists, rejects with ContractNotFoundError / ContractValidationError otherwise
 */
export async function validateContractOnNetwork(
  network: Network
): Promise<ContractValidationResult> {
  if (!isValidNetwork(network)) {
    throw new ContractValidationError(`Invalid network: ${network}`, network);
  }

  const cached = validationCache.get(network);
  if (cached) return cached;

  const address = getContractAddress(network);

  const validationPromise: Promise<ContractValidationResult> = (async () => {
    try {
      const server = await getServer(network);
      await withTimeout(
        server.getContractWasmByContractId(address),
        30000,
        `Timed out validating contract on ${network}`
      );
      return { exists: true, deployed: true };
    } catch (err) {
      validationCache.delete(network);
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("not found") ||
        message.includes("cannot be found") ||
        message.includes("NotFound")
      ) {
        throw new ContractNotFoundError(network, err);
      }
      throw new ContractValidationError(
        `Contract validation failed on ${network}: ${message}`,
        network,
        err
      );
    }
  })();

  validationCache.set(network, validationPromise);
  return validationPromise;
}

/**
 * Check if the contract has a mint-related function (best-effort).
 * Does not invoke the function; validation is primarily "contract exists".
 * Full "has mint" check would require contract spec or simulateTransaction.
 */
export async function validateContractHasMint(
  _network: Network
): Promise<boolean> {
  await validateContractOnNetwork(_network);
  return true;
}

/**
 * Simulate a Soroban contract invocation using the Soroban RPC server.
 * Builds the transaction, simulates it, and returns the assembled XDR ready for signing.
 *
 * @param params - Contract call parameters
 * @returns The prepared transaction (XDR), simulation results, publicKey and network passphrase
 */
export async function simulateSorobanContract(
  params: SorobanContractCallParams
): Promise<SimulationResult> {
  const publicKey = params.publicKey ?? (await connectFreighter());
  const server = await getServer(params.network);
  const account = await withTimeout(
    server.getAccount(publicKey),
    params.timeoutMs ?? 30000,
    "Fetching account timed out"
  );

  const contractAddress = getContractAddress(params.network);
  const scVals = params.args.map((arg) => nativeToScVal(arg));
  const op = Operation.invokeContractFunction({
    contract: contractAddress,
    function: params.method,
    args: scVals,
  });

  const fee = params.fee ?? BASE_FEE;
  const networkPassphrase =
    params.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
  const tx = new TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const simulation = await withTimeout(
    server.simulateTransaction(tx),
    params.timeoutMs ?? 30000,
    "Simulation timed out"
  );

  if (SorobanRpc.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, simulation);
  return {
    xdr: prepared.toXDR(),
    simulationResults: simulation.results ?? null,
    publicKey,
    networkPassphrase,
  };
}

/**
 * Build, simulate, sign (via Freighter), and send a Soroban contract invocation.
 * Handles user rejection and network latency with timeouts.
 *
 * @param params - Contract call parameters
 * @returns The transaction hash and the final network response
 */
export async function sendSorobanContract(
  params: SorobanContractCallParams
): Promise<ContractCallResult> {
  const simulation = await simulateSorobanContract(params);

  let signedXdr: string;
  try {
    signedXdr = await withTimeout(
      signTransaction(simulation.xdr, {
        networkPassphrase: simulation.networkPassphrase,
        accountToSign: simulation.publicKey,
      }),
      params.timeoutMs ?? 30000,
      "Signing transaction timed out"
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/rejected|declined|cancel/i.test(message)) {
      throw new Error("User rejected the transaction signature.");
    }
    throw new Error(`Failed to sign transaction: ${message}`);
  }

  const server = await getServer(params.network);
  const sendDeadline = Date.now() + (params.timeoutMs ?? 30000);
  let sent = await withTimeout(
    server.sendTransaction(signedXdr),
    Math.max(0, sendDeadline - Date.now()),
    "Sending transaction timed out"
  );

  while (sent.status === "TRY_AGAIN_LATER") {
    const remaining = sendDeadline - Date.now();
    if (remaining < 1000) {
      throw new Error("Stellar RPC is busy. Please retry shortly.");
    }
    await delay(Math.min(1000, remaining - 500));
    sent = await withTimeout(
      server.sendTransaction(signedXdr),
      Math.max(0, sendDeadline - Date.now()),
      "Sending transaction timed out"
    );
  }

  if (sent.status === "ERROR") {
    const message =
      sent.errorResult?.result?.message ?? sent.errorResult?.error ?? "Unknown error";
    throw new Error(`Failed to send transaction: ${message}`);
  }

  return pollForTransaction(server, sent.hash, params.timeoutMs ?? 30000);
}
