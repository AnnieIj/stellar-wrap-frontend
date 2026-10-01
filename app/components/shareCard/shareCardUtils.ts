/**
 * Pure utility functions for the ShareCard feature.
 *
 * These functions have no React or browser dependencies, making them
 * straightforward to unit-test in isolation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Subset of transaction states used by the mint flow. */
export type MintTransactionState =
  | "idle"
  | "building"
  | "simulating"
  | "signing"
  | "submitting"
  | "confirming"
  | "confirmed"
  | "failed";

/** Shape of the i18n helper passed to getMintButtonText. */
export interface MintButtonTextTranslator {
  (key: string, values?: Record<string, unknown>): string;
}

// ---------------------------------------------------------------------------
// getMintButtonText
// ---------------------------------------------------------------------------

/**
 * Returns the label to show inside the Mint button based on the current
 * transaction state and optional sub-state flags.
 *
 * @param transactionState - current state of the minting transaction
 * @param t               - next-intl translation function for the ShareCard namespace
 * @param opts.confirmingAttempt - current polling attempt count (1-60), or null
 * @param opts.confirmingTimedOut - true when the confirmation window expired
 * @param opts.isOnline   - whether the device has network access
 */
export function getMintButtonText(
  transactionState: MintTransactionState,
  t: MintButtonTextTranslator,
  opts: {
    confirmingAttempt: number | null;
    confirmingTimedOut: boolean;
    isOnline: boolean;
  },
): string {
  const { confirmingAttempt, isOnline } = opts;

  switch (transactionState) {
    case "building":
      return t("buildingTransaction");
    case "simulating":
      return t("simulatingTransaction");
    case "signing":
      return t("awaitingSignature");
    case "submitting":
      return confirmingAttempt !== null
        ? t("confirmingAttempt", { attempt: confirmingAttempt })
        : t("submittingTransaction");
    case "confirming":
      return confirmingAttempt !== null
        ? t("confirmingAttempt", { attempt: confirmingAttempt })
        : t("confirmingTransaction");
    case "confirmed":
      return t("minted");
    case "failed":
      return t("retryMint");
    default:
      return isOnline ? t("mintWrap") : t("mintUnavailableOffline");
  }
}

// ---------------------------------------------------------------------------
// buildShareText
// ---------------------------------------------------------------------------

/**
 * Builds the pre-filled tweet/share text for the X (Twitter) intent URL.
 *
 * @param persona      - the user's persona label, e.g. "The DeFi Patron"
 * @param transactions - total transaction count
 * @param year         - the wrap year (defaults to the current year)
 */
export function buildShareText(
  persona: string,
  transactions: number,
  year: number = new Date().getFullYear(),
): string {
  return `I'm ${persona} on Stellar! 🚀 ${transactions} transactions in ${year}. #StellarWrapped. (Upload your Stellar Wrapped Card manually.)`;
}

// ---------------------------------------------------------------------------
// getExplorerUrl
// ---------------------------------------------------------------------------

/** Stellar network identifier. */
export type StellarNetwork = "mainnet" | "testnet" | string;

/**
 * Returns the Stellar.expert explorer URL for a given resource.
 *
 * @param resource  - "account" | "tx"
 * @param id        - the account address or transaction hash
 * @param network   - "mainnet" maps to "public"; everything else maps to "testnet"
 */
export function getExplorerUrl(
  resource: "account" | "tx",
  id: string,
  network: StellarNetwork,
): string {
  const net = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${net}/${resource}/${id}`;
}
