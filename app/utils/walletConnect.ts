import { isConnected, getAddress, requestAccess, getNetworkDetails, signTransaction } from "@stellar/freighter-api";
import {
  BASE_FEE,
  Contract,
  SorobanRpc,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { Network, NETWORK_PASSPHRASES } from "../../src/config";
import type { WalletProvider } from "../store/walletStore";

export const FREIGHTER_INSTALL_URL = "https://www.freighter.app/";

export class FreighterNotInstalledError extends Error {
  readonly installUrl = FREIGHTER_INSTALL_URL;

  constructor() {
    super("Freighter is not installed. Install Freighter, then retry connection.");
    this.name = "FreighterNotInstalledError";
  }
}

export interface AlbedoPublicKeyResult {
  publicKey: string;
}

export interface AlbedoTxParams {
  /** Base64 transaction XDR to sign. */
  tx: string;
  /** Network passphrase (required — Albedo refuses unsigned unknown networks). */
  network: string;
  /** If true, Albedo submits the signed transaction to its own fleet. */
  submit?: boolean;
  /** Restrict signing to this public key. */
  pubkey?: string;
}

export interface AlbedoTxResult {
  /** Signed transaction XDR (base64). */
  tx: string;
  signed: boolean;
  network: string;
  pubkey: string;
}

export interface Albedo {
  publicKey: (params?: Record<string, unknown>) => Promise<AlbedoPublicKeyResult>;
  tx: (params: AlbedoTxParams) => Promise<AlbedoTxResult>;
}

declare global {
  interface Window {
    freighter?: unknown;
    albedo?: Albedo;
  }
}

/**
 * Thrown by connectFreighter when the wallet's active network does not match
 * the network the app is configured to use.
 */
export class NetworkMismatchError extends Error {
  /** The network the app expects (e.g. "testnet") */
  readonly expected: Network;
  /** The network Freighter is currently on (e.g. "mainnet") */
  readonly actual: string;

  constructor(expected: Network, actual: string) {
    super(
      `Wallet network mismatch: Freighter is on "${actual}" but the app is set to "${expected}". ` +
        `Please switch Freighter to "${expected}" and try again.`,
    );
    this.name = "NetworkMismatchError";
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Queries Freighter for the network it is currently connected to and maps it
 * to one of the app's known Network values ("mainnet" | "testnet").
 *
 * Uses the network passphrase as the canonical identifier so the comparison is
 * robust to display-name variations ("STANDALONE", custom labels, etc.).
 *
 * @returns The app-facing network name, or null if Freighter is not installed
 *          or the network cannot be determined.
 */
export const getFreighterNetwork = async (): Promise<Network | null> => {
  try {
    const result = await getNetworkDetails();
    if (result.error || !result.networkPassphrase) {
      return null;
    }
    const passphrase = result.networkPassphrase.trim();
    if (passphrase === NETWORK_PASSPHRASES.mainnet) return "mainnet";
    if (passphrase === NETWORK_PASSPHRASES.testnet) return "testnet";
    // Unknown / custom network — return null so the caller can decide
    return null;
  } catch {
    return null;
  }
};

/**
 * Checks if the Freighter browser extension is available.
 */
export const isFreighterInstalled = async (): Promise<boolean> => {
  if (typeof window === "undefined") {
    return false;
  }

  if ("freighter" in window && window.freighter) {
    return true;
  }

  try {
    const result = await isConnected();
    return !result.error;
  } catch {
    return false;
  }
};

/**
 * Connects to Freighter wallet and returns the user's public key.
 *
 * After obtaining access, the wallet's active network is compared against
 * `network`. If they differ a `NetworkMismatchError` is thrown so the caller
 * can surface a switch-network prompt instead of silently indexing the wrong
 * chain.
 *
 * @param network - The network the app expects (mainnet or testnet)
 * @throws {NetworkMismatchError} If Freighter is on a different network
 * @throws {Error} If wallet is not installed, user rejects connection, or any other error occurs
 */
export const connectFreighter = async (network: Network): Promise<string> => {
  const installed = await isFreighterInstalled();

  if (!installed) {
    throw new FreighterNotInstalledError();
  }

  try {
    const accessResult = await requestAccess();

    if (accessResult.error || !accessResult.address) {
      throw new Error(
        "Connection rejected. Please approve the connection in Freighter.",
      );
    }

    // Validate that Freighter is on the same network the app expects.
    // We do this after requestAccess so we only prompt once.
    const walletNetwork = await getFreighterNetwork();
    if (walletNetwork !== null && walletNetwork !== network) {
      throw new NetworkMismatchError(network, walletNetwork);
    }

    return accessResult.address;
  } catch (error: unknown) {
    if (error instanceof NetworkMismatchError) {
      throw error;
    }
    if (error instanceof Error) {
      if (error.message?.includes("User declined")) {
        throw new Error("Connection rejected by user.");
      }
      throw error;
    }

    throw new Error("Failed to connect to Freighter wallet. Please try again.");
  }
};

/**
 * Gets the currently connected public key without requesting access
 * Returns null if not connected or if Freighter is not installed
 */
export const getCurrentPublicKey = async (): Promise<string | null> => {
  try {
    const installed = await isFreighterInstalled();
    if (!installed) {
      return null;
    }

    const addressResult = await getAddress();
    return addressResult.error ? null : addressResult.address;
  } catch {
    return null;
  }
};
const RPC_URLS: Record<Network, string> = {
  mainnet: "https://soroban-rpc.mainnet.stellar.org",
  testnet: "https://soroban-testnet.stellar.org",
};

const SOROBAN_TIMEOUT_MS = 10_000;

const SOROBAN_RETRY_MAX_ATTEMPTS = 3;
const SOROBAN_RETRY_BASE_DELAY_MS = 500;

const sorobanServers = new Map<Network, SorobanRpc.Server>();

export const getSorobanRpcServer = (network: Network): SorobanRpc.Server => {
  const cached = sorobanServers.get(network);
  if (cached) {
    return cached;
  }

  const server = new SorobanRpc.Server(RPC_URLS[network]);
  sorobanServers.set(network, server);
  return server;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const stellarToStroops = (amount: string | number): bigint => {
  const normalized = String(amount).trim();
  const [whole, fraction = ""] = normalized.split(".");
  const isNegative = whole.startsWith("-");
  const unsignedWhole = isNegative ? whole.slice(1) : whole;

  if (!/^\d+$/.test(unsignedWhole) || !/^\d*$/.test(fraction)) {
    throw new Error("Invalid Stellar amount.");
  }

  if (fraction.length > 7) {
    throw new Error("Stellar amount cannot have more than 7 decimal places.");
  }

  const stroops = BigInt(unsignedWhole) * 10_000_000n + BigInt(fraction.padEnd(7, "0"));

  return isNegative ? -stroops : stroops;
};

export const stroopsToStellar = (stroops: bigint): string => {
  const sign = stroops < 0n ? "-" : "";
  const absolute = stroops < 0n ? -stroops : stroops;
  const whole = absolute / 10_000_000n;
  const fraction = absolute % 10_000_000n;

  return `${sign}${whole}.${fraction.toString().padStart(7, "0")}`;
};

export const isValidContractAddress = (address: string): boolean => {
  return /^C[A-Z2-7]{55}$/.test(address.trim());
};

export interface SorobanInvocation {
  network: Network;
  contractId: string;
  method: string;
  args: xdr.ScVal[];
  source: string;
  signerAddress?: string;
}

type FreighterSignResult = string | { signedTxXDR: string };

const signSorobanTransactionWithFreighter = async (
  transactionXdr: string,
  networkPassphrase: string,
  address: string,
): Promise<string> => {
  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new FreighterNotInstalledError();
  }

  try {
    const signed = (await signTransaction(transactionXdr, {
      networkPassphrase,
      address,
    })) as FreighterSignResult;

    if (typeof signed === "string") {
      if (!signed) {
        throw new Error("Freighter returned an empty signature.");
      }
      return signed;
    }

    if (typeof signed.signedTxXDR === "string") {
      return signed.signedTxXDR;
    }

    throw new Error("Freighter returned an invalid signature response.");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const normalizedMessage = message.toLowerCase();
    if (
      normalizedMessage.includes("declined") ||
      normalizedMessage.includes("rejected") ||
      normalizedMessage.includes("cancel") ||
      normalizedMessage.includes("denied")
    ) {
      throw new Error("Transaction signature rejected by user.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(message || "Failed to sign the Soroban transaction.");
  }
};

export const simulateSorobanTransaction = async (
  transaction: Transaction,
  network: Network,
): Promise<Transaction> => {
  const server = getSorobanRpcServer(network);

  return withTimeout(
    server.prepareTransaction(transaction),
    SOROBAN_TIMEOUT_MS,
    "Soroban RPC timed out while simulating the transaction.",
  );
};

export const sendSorobanTransaction = async (
  transaction: Transaction,
  network: Network,
): Promise<string> => {
  const server = getSorobanRpcServer(network);

  let sendResponse = await withTimeout(
    server.sendTransaction(transaction),
    SOROBAN_TIMEOUT_MS,
    "Soroban RPC timed out while sending the transaction.",
  );

  for (
    let attempt = 1;
    sendResponse.status === "TRY_AGAIN_LATER" && attempt <= SOROBAN_RETRY_MAX_ATTEMPTS;
    attempt += 1
  ) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, SOROBAN_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    });
    sendResponse = await withTimeout(
      server.sendTransaction(transaction),
      SOROBAN_TIMEOUT_MS,
      "Soroban RPC timed out while sending the transaction.",
    );
  }

  if (sendResponse.status === "TRY_AGAIN_LATER") {
    throw new Error("Soroban RPC is rate limited. Please retry shortly.");
  }

  if (
    sendResponse.status !== "PENDING" &&
    sendResponse.status !== "DUPLICATE"
  ) {
    throw new Error("Soroban transaction submission failed.");
  }

  return sendResponse.hash;
};

export const invokeSorobanContract = async (
  invocation: SorobanInvocation,
): Promise<string> => {
  const { network, contractId, method, args, source, signerAddress } = invocation;

  if (!isValidContractAddress(contractId)) {
    throw new Error("Invalid Soroban contract ID.");
  }

  if (!isValidStellarAddress(source)) {
    throw new Error("Invalid source account.");
  }

  if (signerAddress !== undefined && !isValidStellarAddress(signerAddress)) {
    throw new Error("Invalid signer address.");
  }

  const server = getSorobanRpcServer(network);
  const networkPassphrase = NETWORK_PASSPHRASES[network];

  const account = await withTimeout(
    server.getAccount(source),
    SOROBAN_TIMEOUT_MS,
    "Soroban RPC timed out while loading the account.",
  );

  const contract = new Contract(contractId);
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(0)
    .build();

  const preparedTransaction = await simulateSorobanTransaction(transaction, network);

  const signedTransactionXdr = await signSorobanTransactionWithFreighter(
    preparedTransaction.toXDR(),
    networkPassphrase,
    signerAddress ?? source,
  );
  const signedTransaction = TransactionBuilder.fromXDR(
    signedTransactionXdr,
    networkPassphrase,
  );

  return sendSorobanTransaction(signedTransaction, network);
};

/**
 * Checks if Albedo wallet is available
 */
export const isAlbedoInstalled = (): boolean => {
  return typeof window !== "undefined" && typeof window.albedo !== "undefined";
};

/**
 * Connects to Albedo wallet and returns the user's public key
 * @param _network - The network to connect to (mainnet or testnet)
 * @throws {Error} If Albedo is not available, popup is blocked, or user rejects
 */
export const connectAlbedo = async (_network: Network): Promise<string> => {
  if (!isAlbedoInstalled() || !window.albedo) {
    throw new Error(
      "Albedo wallet not found. Please install the Albedo browser extension.",
    );
  }

  try {
    const result = await window.albedo.publicKey({});
    if (!result?.publicKey) {
      throw new Error(
        "Connection rejected. Please approve the connection in Albedo.",
      );
    }

    return result.publicKey;
  } catch (error: unknown) {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes("popup") || message.includes("blocked")) {
        throw new Error(
          "Albedo popup was blocked by your browser. Please allow popups for this site.",
        );
      }
      if (
        message.includes("cancel") ||
        message.includes("declined") ||
        message.includes("rejected")
      ) {
        throw new Error("Connection rejected by user.");
      }
      throw error;
    }
    throw new Error("Failed to connect to Albedo wallet. Please try again.");
  }
};

export const isValidStellarAddress = (address: string): boolean => {
  if (!address || typeof address !== "string") {
    return false;
  }

  const trimmedAddress = address.trim();

  if (!trimmedAddress.startsWith("G") || trimmedAddress.length !== 56) {
    return false;
  }

  const base32Regex = /^[A-Z2-7]{56}$/;
  return base32Regex.test(trimmedAddress);
};

interface XBullPublicKeyResult {
  publicKey?: string;
}

interface XBull {
  getPublicKey(): Promise<XBullPublicKeyResult>;
}

declare global {
  interface Window {
    xBull?: XBull;
  }
}

/**
 * Checks if the xBull browser extension is available
 */
export const isXBullInstalled = (): boolean => {
  return typeof window !== "undefined" && typeof window.xBull !== "undefined";
};

/**
 * Connects to xBull wallet and returns the user's public key
 * @param _network - The network to connect to (mainnet or testnet)
 * @throws {Error} If xBull is not installed, user rejects connection, or any other error occurs
 */
export const connectXBull = async (_network: Network): Promise<string> => {
  if (!isXBullInstalled() || !window.xBull) {
    throw new Error(
      "xBull wallet not found. Please install the xBull browser extension from the Chrome Web Store.",
    );
  }

  try {
    const result = await window.xBull.getPublicKey();

    if (!result?.publicKey) {
      throw new Error(
        "Connection rejected. Please approve the connection in xBull.",
      );
    }

    return result.publicKey;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (
        error.message?.includes("User rejected") ||
        error.message?.includes("rejected")
      ) {
        throw new Error("Connection rejected by user.");
      }
      throw error;
    }

    throw new Error("Failed to connect to xBull wallet. Please try again.");
  }
};

// ─── Session re-validation ──────────────────────────────────────────────────

/**
 * Races a promise against a timeout so a slow/hung wallet probe can never
 * block the UI on app reload. Kept local to avoid coupling the wallet
 * utilities to the transaction signer.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const guarded = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    return await Promise.race([promise, guarded]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export type WalletValidationResult =
  | { ok: true }
  | { ok: false; reason: "disconnected" | "network-mismatch" | "timeout" | "error" };

const REVALIDATION_TIMEOUT_MS = 8_000;

/**
 * Non-interactively re-validates a persisted wallet session on app reload,
 * without prompting the user.
 *
 * - Browser-extension wallets (Freighter/Albedo/xBull) are checked for
 *   availability; Freighter is additionally checked for network match so a
 *   switched-network session is flagged instead of silently indexing the wrong
 *   chain.
 * - "manual" and "demo" modes have no live wallet; they pass through (nothing
 *   to validate) as long as the address is a valid Stellar address.
 *
 * Never throws: callers use this to gracefully decide whether a restored
 * session can be trusted or should be marked `needsReconnect`.
 */
export async function validateWalletConnection(
  provider: WalletProvider | null,
  address: string,
  network: Network,
): Promise<WalletValidationResult> {
  if (!address) {
    return { ok: false, reason: "disconnected" };
  }
  if (!isValidStellarAddress(address)) {
    return { ok: false, reason: "disconnected" };
  }

  switch (provider) {
    case "manual":
    case "demo":
      // Address-only modes have nothing live to re-check.
      return { ok: true };
    case "freighter": {
      try {
        const installed = await withTimeout(
          isFreighterInstalled(),
          REVALIDATION_TIMEOUT_MS,
          "Freighter availability check timed out.",
        );
        if (!installed) {
          return { ok: false, reason: "disconnected" };
        }
        const walletNetwork = await withTimeout(
          getFreighterNetwork(),
          REVALIDATION_TIMEOUT_MS,
          "Freighter network check timed out.",
        );
        if (walletNetwork !== null && walletNetwork !== network) {
          return { ok: false, reason: "network-mismatch" };
        }
        return { ok: true };
      } catch {
        return { ok: false, reason: "timeout" };
      }
    }
    case "albedo":
      return isAlbedoInstalled() ? { ok: true } : { ok: false, reason: "disconnected" };
    case "xbull":
      return isXBullInstalled() ? { ok: true } : { ok: false, reason: "disconnected" };
    case "walletconnect":
      // WalletConnect has no non-interactive reachability probe; the modal
      // would need the user to re-approve, so treat as connected until the
      // user interacts (keeps the restored address visible).
      return { ok: true };
    case null:
      return { ok: false, reason: "disconnected" };
    default:
      // Unreachable — WalletProvider|null is fully covered above. Kept for
      // exhaustiveness so adding a provider is a compile-time reminder.
      return { ok: false, reason: "disconnected" };
  }
}
