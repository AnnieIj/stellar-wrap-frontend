/**
 * Service for Stellar Asset Trustline transactions using stellar-sdk and Freighter wallet.
 *
 * Implements:
 * - change_trust Operation construction
 * - 7-decimal limit validation
 * - Freighter transaction signing & rejection parsing
 * - Rate-limited Horizon RPC submission using horizonQueue
 * - Network timeouts and connectivity resilience
 */

import {
  Asset,
  Horizon,
  Operation,
  Transaction,
  TransactionBuilder,
  BASE_FEE,
  Networks,
} from "stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { Network, NETWORK_PASSPHRASES, RPC_ENDPOINTS } from "../config";
import { horizonQueue } from "../utils/horizonRequestQueue";
import { isValidStellarAmount, MAX_STELLAR_LIMIT } from "../utils/stellarAmount";
import type { CreateTrustlineParams, TrustlineResult } from "../types/trustline";

export class TrustlineError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "TrustlineError";
  }
}

/**
 * Creates an Asset instance from code and issuer.
 */
export function buildStellarAsset(code: string, issuer: string): Asset {
  const cleanCode = code.trim().toUpperCase();
  const cleanIssuer = issuer.trim();

  if (!cleanCode || cleanCode.length > 12) {
    throw new TrustlineError(
      `Invalid asset code "${code}": must be 1 to 12 alphanumeric characters.`,
      "INVALID_ASSET_CODE"
    );
  }

  if (!cleanIssuer.startsWith("G") || cleanIssuer.length !== 56) {
    throw new TrustlineError(
      `Invalid asset issuer "${issuer}": must be a valid 56-character Stellar public key starting with G.`,
      "INVALID_ISSUER"
    );
  }

  return new Asset(cleanCode, cleanIssuer);
}

/**
 * Parses user / wallet errors into friendly, clear error messages.
 */
export function parseTrustlineError(error: unknown): string {
  if (error instanceof TrustlineError) {
    return error.message;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (
      msg.includes("user declined") ||
      msg.includes("rejected") ||
      msg.includes("user cancelled") ||
      msg.includes("declined")
    ) {
      return "Transaction was rejected by the user in the wallet.";
    }

    if (msg.includes("timeout") || msg.includes("timed out")) {
      return "Network connection timed out. Please check your network connection and retry.";
    }

    if (
      msg.includes("insufficient_fee") ||
      msg.includes("fee") ||
      msg.includes("op_underfunded")
    ) {
      return "Insufficient XLM balance to pay the transaction fee or minimum reserve.";
    }

    if (msg.includes("op_low_reserve")) {
      return "Account does not have enough XLM reserve to create a new trustline.";
    }

    if (msg.includes("op_no_issuer")) {
      return "The asset issuer account does not exist on the Stellar network.";
    }

    if (msg.includes("op_invalid_limit")) {
      return "The specified trustline limit is invalid.";
    }

    if (msg.includes("rate limit") || msg.includes("429")) {
      return "Network rate limit reached. The request has been queued for automatic retry.";
    }

    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected error occurred while creating the trustline.";
}

/**
 * Builds, signs via Freighter, and submits a change_trust transaction to Horizon.
 */
export async function createAssetTrustline(
  params: CreateTrustlineParams
): Promise<TrustlineResult> {
  const { accountAddress, assetCode, assetIssuer, limit, network } = params;

  if (!accountAddress || typeof accountAddress !== "string") {
    throw new TrustlineError("Account address is required.", "MISSING_ACCOUNT");
  }

  // 1. Validate and construct asset
  const asset = buildStellarAsset(assetCode, assetIssuer);

  // 2. Validate limit if provided
  let formattedLimit: string | undefined;
  if (limit && limit.trim() !== "") {
    if (!isValidStellarAmount(limit)) {
      throw new TrustlineError(
        `Invalid trustline limit "${limit}": must be a positive number with at most 7 decimal places up to ${MAX_STELLAR_LIMIT}.`,
        "INVALID_LIMIT"
      );
    }
    formattedLimit = limit.trim();
  }

  // 3. Load account from Horizon using rate-limited queue
  const horizonUrl = RPC_ENDPOINTS[network];
  const server = new Horizon.Server(horizonUrl);

  let accountResponse: Horizon.AccountResponse;
  try {
    accountResponse = await horizonQueue.enqueue(() =>
      server.loadAccount(accountAddress)
    );
  } catch (error) {
    const parsed = parseTrustlineError(error);
    throw new TrustlineError(
      `Failed to load account ${accountAddress}: ${parsed}`,
      "LOAD_ACCOUNT_FAILED",
      error
    );
  }

  // 4. Build transaction with Operation.changeTrust
  const networkPassphrase =
    NETWORK_PASSPHRASES[network] ||
    (network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET);

  const txBuilder = new TransactionBuilder(accountResponse, {
    fee: BASE_FEE,
    networkPassphrase,
  });

  txBuilder.addOperation(
    Operation.changeTrust({
      asset,
      limit: formattedLimit,
    })
  );

  // Set 60-second timeout window
  txBuilder.setTimeout(60);

  const transaction = txBuilder.build();
  const txXdr = transaction.toXDR();

  // 5. Sign with Freighter
  let signedXdr: string;
  try {
    const signResult = await signTransaction(txXdr, {
      networkPassphrase,
    });

    if (signResult.error) {
      throw new TrustlineError(
        parseTrustlineError(new Error(signResult.error)),
        "SIGNING_FAILED"
      );
    }

    if (!signResult.signedTxXdr) {
      throw new TrustlineError(
        "Wallet returned an empty signed transaction.",
        "EMPTY_SIGNED_TX"
      );
    }

    signedXdr = signResult.signedTxXdr;
  } catch (error) {
    const parsed = parseTrustlineError(error);
    throw new TrustlineError(parsed, "SIGNING_FAILED", error);
  }

  // 6. Submit via rate-limited queue
  try {
    const signedTx = TransactionBuilder.fromXDR(
      signedXdr,
      networkPassphrase
    ) as Transaction;

    const response = await horizonQueue.enqueue(() =>
      server.submitTransaction(signedTx)
    );

    return {
      transactionHash: response.hash,
      ledger: response.ledger,
      assetCode: asset.getCode(),
      assetIssuer: asset.getIssuer(),
    };
  } catch (error) {
    const parsed = parseTrustlineError(error);
    throw new TrustlineError(parsed, "SUBMISSION_FAILED", error);
  }
}
