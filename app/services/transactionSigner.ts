/**
 * Wallet transaction signer.
 *
 * A decoupled, wallet-agnostic layer that signs a Stellar transaction XDR
 * through the user's connected Web3 wallet (Freighter, Albedo, …) and returns a
 * structured result instead of throwing for expected failures:
 *
 *   - user rejects the signature prompt
 *   - wallet is not installed / disconnected
 *   - wallet is on the wrong network
 *   - the wallet prompt times out
 *
 * It also exposes `verifyWalletForNetwork`, used by the Network Switch flow to
 * re-validate the connected wallet (e.g. Freighter) against the target network
 * before committing to a switch — without fabricating an on-chain transaction.
 *
 * Strict-TypeScript friendly: every failure is a discriminated union, no `any`.
 *
 * @module transactionSigner
 */

import { signTransaction } from "@stellar/freighter-api";
import { Network, NETWORK_PASSPHRASES } from "../../src/config";
import {
  getFreighterNetwork,
  isAlbedoInstalled,
  isFreighterInstalled,
  isXBullInstalled,
} from "../utils/walletConnect";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WalletProvider = "freighter" | "albedo" | "xbull" | "walletconnect";

export type SignFailureCode =
  | "not-installed"
  | "disconnected"
  | "network-mismatch"
  | "rejected"
  | "timeout"
  | "sign-error";

export interface SignRequest {
  /** Base64 transaction XDR to sign. */
  transactionXdr: string;
  network: Network;
  /** Milliseconds to wait for the wallet prompt before timing out. */
  timeoutMs?: number;
}

export interface SignFailure {
  ok: false;
  code: SignFailureCode;
  message: string;
  provider: WalletProvider;
}

export type SignResult =
  | { ok: true; signedXdr: string; provider: WalletProvider }
  | SignFailure;

export type WalletGuardResult =
  | { ok: true }
  | {
      ok: false;
      code: "network-mismatch" | "disconnected" | "timeout" | "error";
      message: string;
      actual?: Network | null;
    };

// ─── Constants ──────────────────────────────────────────────────────────────

/** Wallet prompts commonly sit open for a while; mirror the mint timeout. */
export const DEFAULT_SIGN_TIMEOUT_MS = 120_000;

export const USER_REJECTED_MESSAGE =
  "The transaction signature was rejected in your wallet.";

// ─── Error helpers ──────────────────────────────────────────────────────────

/** Internal marker used by `withTimeout`; never crosses module boundaries. */
class OperationTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationTimeoutError";
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Normalizes the many ways a wallet reports that the user declined a prompt.
 */
export function isUserRejection(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return (
    message.includes("user declined") ||
    message.includes("user rejected") ||
    message.includes("user canceled") ||
    message.includes("user cancelled") ||
    message.includes("rejected by user") ||
    message.includes("declined by user") ||
    message.includes("failed to complete sign in") ||
    message.includes("rejected") ||
    message.includes("declined") ||
    message.includes("canceled") ||
    message.includes("cancelled") ||
    message.includes("request canceled") ||
    message.includes("request cancelled") ||
    message.includes("transactionsignature request rejected")
  );
}

/**
 * Race a promise against a timeout. The rejection reason is a private error
 * type so callers can recover cleanly instead of surfacing raw race errors.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const guarded = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new OperationTimeoutError(timeoutMessage)),
        timeoutMs,
      );
    });
    return await Promise.race([promise, guarded]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function failure(
  provider: WalletProvider,
  code: SignFailureCode,
  message: string,
): SignFailure {
  return { ok: false, code, message, provider };
}

// ─── Provider signers ───────────────────────────────────────────────────────

/**
 * Signs a transaction with the Freighter extension.
 */
export async function signWithFreighter(
  request: SignRequest,
): Promise<SignResult> {
  const provider: WalletProvider = "freighter";
  const timeoutMs = request.timeoutMs ?? DEFAULT_SIGN_TIMEOUT_MS;

  try {
    const installed = await withTimeout(
      isFreighterInstalled(),
      timeoutMs,
      "Freighter availability check timed out. Please try again.",
    );
    if (!installed) {
      return failure(
        provider,
        "not-installed",
        "Freighter is not installed. Install the Freighter extension to sign this transaction.",
      );
    }

    const result = await withTimeout(
      signTransaction(request.transactionXdr, {
        networkPassphrase: NETWORK_PASSPHRASES[request.network],
      }),
      timeoutMs,
      `Freighter did not respond within ${Math.round(timeoutMs / 1000)}s. Please try again.`,
    );

    if (result.error) {
      const rawMessage = result.error.message;
      if (isUserRejection(rawMessage)) {
        return failure(provider, "rejected", USER_REJECTED_MESSAGE);
      }
      return failure(
        provider,
        "sign-error",
        rawMessage || "Freighter failed to sign the transaction.",
      );
    }

    if (!result.signedTxXdr) {
      return failure(
        provider,
        "sign-error",
        "Freighter returned an empty signed transaction.",
      );
    }

    return { ok: true, signedXdr: result.signedTxXdr, provider };
  } catch (error) {
    if (error instanceof OperationTimeoutError) {
      return failure(provider, "timeout", error.message);
    }
    if (isUserRejection(error)) {
      return failure(provider, "rejected", USER_REJECTED_MESSAGE);
    }
    return failure(provider, "sign-error", toErrorMessage(error));
  }
}

/**
 * Signs a transaction with the Albedo browser extension.
 *
 * Albedo validates the passphrase; signing on the wrong network is surfaced as
 * a `network-mismatch` failure so the caller can prompt the user to switch.
 */
export async function signWithAlbedo(request: SignRequest): Promise<SignResult> {
  const provider: WalletProvider = "albedo";
  const timeoutMs = request.timeoutMs ?? DEFAULT_SIGN_TIMEOUT_MS;

  if (
    typeof window === "undefined" ||
    !isAlbedoInstalled() ||
    !window.albedo
  ) {
    return failure(
      provider,
      "not-installed",
      "Albedo wallet not found. Install the Albedo browser extension to sign this transaction.",
    );
  }

  try {
    const result = await withTimeout(
      window.albedo.tx({
        tx: request.transactionXdr,
        network: NETWORK_PASSPHRASES[request.network],
        submit: false,
      }),
      timeoutMs,
      `Albedo did not respond within ${Math.round(timeoutMs / 1000)}s. Please try again.`,
    );

    if (!result || !result.tx) {
      return failure(
        provider,
        "sign-error",
        "Albedo returned an empty signed transaction.",
      );
    }

    return { ok: true, signedXdr: result.tx, provider };
  } catch (error) {
    if (error instanceof OperationTimeoutError) {
      return failure(provider, "timeout", error.message);
    }
    const message = toErrorMessage(error);
    if (isUserRejection(message)) {
      return failure(provider, "rejected", USER_REJECTED_MESSAGE);
    }
    const lower = message.toLowerCase();
    if (
      lower.includes("network") &&
      (lower.includes("mismatch") ||
        lower.includes("does not match") ||
        lower.includes("invalid network") ||
        lower.includes("unsupported network"))
    ) {
      return failure(
        provider,
        "network-mismatch",
        `Albedo is configured for a different network than ${request.network}. Please switch Albedo and try again.`,
      );
    }
    return failure(provider, "sign-error", message);
  }
}

/**
 * Signs a transaction through the given wallet provider.
 */
export async function signWithProvider(
  provider: WalletProvider,
  request: SignRequest,
): Promise<SignResult> {
  switch (provider) {
    case "freighter":
      return signWithFreighter(request);
    case "albedo":
      return signWithAlbedo(request);
    case "xbull":
    case "walletconnect":
      return failure(
        provider,
        "sign-error",
        `${provider} does not have in-app transaction signing support yet.`,
      );
    default: {
      const exhaustive: never = provider;
      return failure("walletconnect", "sign-error", `Unknown wallet: ${exhaustive}`);
    }
  }
}

// ─── Network switch wallet guard ────────────────────────────────────────────

/**
 * Detects which wallet provider is connected, without prompting the user.
 */
export async function detectConnectedProvider(
  timeoutMs: number = DEFAULT_SIGN_TIMEOUT_MS,
): Promise<WalletProvider | null> {
  try {
    if (await withTimeout(isFreighterInstalled(), timeoutMs, "Freighter check timed out")) {
      return "freighter";
    }
  } catch {
    // Treat a failed detection as "no wallet reachable" — never crash the switch.
  }
  if (isAlbedoInstalled()) return "albedo";
  if (isXBullInstalled()) return "xbull";
  return null;
}

/**
 * Re-validates the connected wallet against the network the app is about to
 * switch to. Used by the Network Switch flow before committing the switch.
 *
 * - Freighter exposes a non-interactive network check: a mismatch blocks the
 *   switch with a clear, actionable message.
 * - Albedo / xBull / WalletConnect have no non-interactive network read; they
 *   sign against their own configured network, so they never block the switch.
 * - No installed wallet (manual / demo mode) always succeeds.
 */
export async function verifyWalletForNetwork(
  target: Network,
  timeoutMs: number = DEFAULT_SIGN_TIMEOUT_MS,
): Promise<WalletGuardResult> {
  let freighterInstalled = false;
  try {
    freighterInstalled = await withTimeout(
      isFreighterInstalled(),
      timeoutMs,
      "Freighter availability check timed out. Please try again.",
    );
  } catch {
    return {
      ok: false,
      code: "timeout",
      message: "Wallet availability check timed out. Please try again.",
      actual: null,
    };
  }

  if (!freighterInstalled) {
    // No wallet or a non-Freighter wallet — nothing to validate.
    return { ok: true };
  }

  let walletNetwork: Network | null = null;
  try {
    walletNetwork = await withTimeout(
      getFreighterNetwork(),
      timeoutMs,
      "Wallet network check timed out. Please try again.",
    );
  } catch {
    return {
      ok: false,
      code: "timeout",
      message: "Wallet network check timed out. Please try again.",
      actual: null,
    };
  }

  if (walletNetwork !== null && walletNetwork !== target) {
    const message = `Freighter is connected to "${walletNetwork}", but this app is switching to "${target}". Please switch Freighter to "${target}" and try again.`;
    return { ok: false, code: "network-mismatch", message, actual: walletNetwork };
  }

  return { ok: true };
}