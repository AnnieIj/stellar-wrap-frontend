/**
 * Offer Service
 *
 * Simulates creating a manage_sell_offer operation on the Stellar DEX.
 *
 * In production this would:
 *   1. Build a TransactionBuilder with a ManageSellOffer operation
 *   2. Sign via Freighter (signTransaction)
 *   3. Submit to Horizon and poll for confirmation
 *
 * For now the service simulates the async blockchain flow with realistic
 * latency and probabilistic failure so the optimistic-update pattern is
 * fully exercisable in the UI.
 */

import type { Network } from "../../src/config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateOfferInput {
  /** Stellar public key of the offering account */
  accountAddress: string;
  sellingAsset: string;
  buyingAsset: string;
  /** Amount as a string to preserve precision (whole XLM) */
  amount: string;
  /** Price per unit of selling asset */
  price: string;
  network: Network;
}

export interface CreateOfferResult {
  /** Stellar on-chain offer ID */
  onChainId: string;
  /** Transaction hash */
  txHash: string;
}

export interface OfferServiceError {
  message: string;
  code: "TIMEOUT" | "REJECTED" | "VALIDATION" | "NETWORK_ERROR" | "UNKNOWN";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildOfferError(
  message: string,
  code: OfferServiceError["code"],
): OfferServiceError {
  return { message, code };
}

function validateInput(input: CreateOfferInput): string | null {
  if (!input.accountAddress || !input.accountAddress.startsWith("G")) {
    return "A valid connected Stellar address is required.";
  }
  const amt = parseFloat(input.amount);
  if (isNaN(amt) || amt <= 0) {
    return "Amount must be a positive number.";
  }
  const price = parseFloat(input.price);
  if (isNaN(price) || price <= 0) {
    return "Price must be a positive number.";
  }
  if (!input.sellingAsset || !input.buyingAsset) {
    return "Selling and buying assets are required.";
  }
  if (input.sellingAsset === input.buyingAsset) {
    return "Selling and buying assets must be different.";
  }
  return null;
}

/** Simulate network round-trip with optional failure. */
async function simulateBlockchainCall(
  failProbability = 0.1,
  minMs = 800,
  maxMs = 2400,
): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
  if (Math.random() < failProbability) {
    throw new Error("Simulated network error: transaction not accepted.");
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a DEX sell offer.
 *
 * Validates input, simulates the blockchain flow, and returns a synthetic
 * on-chain offer ID and transaction hash on success.
 *
 * @throws OfferServiceError on validation failure, user rejection, timeout, or network error
 */
export async function createOffer(
  input: CreateOfferInput,
): Promise<CreateOfferResult> {
  // ── Validation ─────────────────────────────────────────────────────────────
  const validationError = validateInput(input);
  if (validationError) {
    throw buildOfferError(validationError, "VALIDATION");
  }

  // ── Simulate blockchain round-trip ─────────────────────────────────────────
  try {
    await simulateBlockchainCall(0.15); // 15% failure rate for demo
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw buildOfferError(err.message, "NETWORK_ERROR");
    }
    throw buildOfferError("Unexpected error during offer submission.", "UNKNOWN");
  }

  // ── Return synthetic result ─────────────────────────────────────────────────
  const onChainId = String(Math.floor(Math.random() * 9_000_000) + 1_000_000);
  const txHash = Array.from({ length: 64 }, () =>
    "0123456789abcdef"[Math.floor(Math.random() * 16)],
  ).join("");

  return { onChainId, txHash };
}

/**
 * Cancel an existing offer by its on-chain ID.
 * Sets the offer amount to 0 which removes it from the DEX.
 *
 * @throws OfferServiceError on failure
 */
export async function cancelOffer(
  _offerId: string,
  _accountAddress: string,
  _network: Network,
): Promise<void> {
  await simulateBlockchainCall(0.05, 500, 1500);
}
