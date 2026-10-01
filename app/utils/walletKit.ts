import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";
import { WalletConnectModule } from "@creit-tech/stellar-wallets-kit/modules/wallet-connect";
import { Network } from "../../src/config";
import {
  ContractConfigurationError,
  InvalidContractAddressError,
  ContractNotFoundError,
  ContractValidationError,
  mapContractError,
} from "./contractErrors";
import { mintWrap as contractMintWrap, type MintWrapOptions, type TransactionObserver } from "../../src/services/contractBridge";
import { useTransactionStore } from "../store/transactionStore";
import { logger } from "./logger";

const log = logger.child("walletKit");

if (
  typeof process !== "undefined" &&
  !process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET &&
  !process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET &&
  !process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
) {
  log.warn(
    "No contract address env set (NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET, NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET, or NEXT_PUBLIC_CONTRACT_ADDRESS). Using placeholder per network.",
  );
}

// Initialize StellarWalletsKit for testnet
let isInitialized = false;

function getStringProperty(data: unknown, key: string): string | null {
  if (data && typeof data === "object" && key in data) {
    const value = (data as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  }

  return null;
}

export function initWalletKit(): void {
  if (!isInitialized && typeof window !== "undefined") {
    StellarWalletsKit.init({
      modules: [
        ...defaultModules(),
        new WalletConnectModule({
          projectId:
            process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
            "stellar-wrapped-2026",
          metadata: {
            name: "Stellar Wrapped",
            description: "Your blockchain story told like never before",
            icons: ["https://stellar.org/favicon.ico"],
            url: window.location.origin,
          },
        }),
      ],
    });
    isInitialized = true;
  }
}

/**
 * Options for minting a wrap NFT
 */
export interface MintWrapParams {
  userAddress: string;
  network: Network;
  /** WrapPeriod from the wrap store, e.g. "weekly" | "monthly" | "yearly" */
  period: string;
  /** Persona/archetype label, e.g. "The DeFi Patron" */
  archetype: string;
  /**
   * Optional pre-fetched attestation. If omitted, mintWrap will call the
   * backend attestation endpoint to obtain a signed hash of the stats.
   */
  attestation?: { dataHash: Uint8Array; signature: Uint8Array };
  observer?: TransactionObserver;
}

/**
 * Fetches a signed attestation (hash + signature) for the user's stats
 * from the backend. This endpoint does not exist yet in this repo — it
 * needs to be implemented server-side before minting will work end-to-end.
 * The server should:
 *   1. Recompute/verify the user's stats independently (not trust the client)
 *   2. Hash the verified stats payload
 *   3. Sign that hash with a key the deployed contract is configured to trust
 *   4. Return { dataHash: hex, signature: hex }
 */
async function fetchMintAttestation(
  accountAddress: string,
  network: Network,
  period: string,
  archetype: string,
): Promise<{ dataHash: Uint8Array; signature: Uint8Array }> {
  const response = await fetch("/api/wrap/attest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountAddress, network, period, archetype }),
  });

  if (!response.ok) {
    throw new ContractValidationError(
      `Failed to obtain mint attestation: ${response.statusText}. ` +
        `The /api/wrap/attest backend endpoint must be implemented before minting can work.`,
    );
  }

  const data = await response.json();

  if (
    typeof data?.dataHash !== "string" ||
    typeof data?.signature !== "string"
  ) {
    throw new ContractValidationError(
      "Attestation response missing dataHash/signature",
    );
  }

  return {
    dataHash: Uint8Array.from(Buffer.from(data.dataHash, "hex")),
    signature: Uint8Array.from(Buffer.from(data.signature, "hex")),
  };
}

/**
 * Mint the user's Stellar Wrapped as a Soulbound Token NFT
 *
 * This function handles the complete Soroban contract invocation lifecycle:
 * - Obtaining a signed attestation (data_hash + signature) for the stats
 * - Building XDR transactions with contract arguments
 * - Simulating transactions
 * - Signing with Freighter wallet
 * - Submitting to network
 * - Polling for confirmation
 *
 * @param params - Minting parameters including address, network, period, and archetype
 * @returns Transaction hash on success
 * @throws Error if minting fails or user rejects transaction
 *
 * @example
 * ```ts
 * const txHash = await mintWrap({
 *   userAddress: 'GABC...XYZ',
 *   network: 'testnet',
 *   period: 'monthly',
 *   archetype: 'The DeFi Patron',
 * });
 * ```
 */
export async function mintWrap(params: MintWrapParams): Promise<string> {
  try {
    initWalletKit();

    const { userAddress, network, period, archetype, observer } = params;

    const attestation =
      params.attestation ??
      (await fetchMintAttestation(userAddress, network, period, archetype));

    const { setTransactionState, setTransactionHash, setTransactionError, resetTransaction } = useTransactionStore.getState();
    resetTransaction();
    setTransactionState("building");

    const bridgedObserver: TransactionObserver = (state, data) => {
      // Call local observer if passed from component
      if (observer) observer(state, data);

      // Update global UI state
      switch (state) {
        case "pending":
          setTransactionState("building");
          break;
        case "simulating":
          setTransactionState("simulating");
          break;
        case "signed":
          setTransactionState("signing");
          break;
        case "submitted":
          setTransactionState("submitting");
          break;
        case "confirmed":
          setTransactionState("confirmed");
          {
            const transactionHash = getStringProperty(data, "transactionHash");
            if (transactionHash) {
              setTransactionHash(transactionHash);
            }
          }
          break;
        case "failed":
          setTransactionState("failed");
          {
            const error = getStringProperty(data, "error");
            if (error) {
              setTransactionError(error);
            }
          }
          break;
      }
    };

    // Build mint options for contract bridge
    const mintOptions: MintWrapOptions = {
      accountAddress: userAddress,
      network,
      period,
      archetype,
      dataHash: attestation.dataHash,
      signature: attestation.signature,
      observer: bridgedObserver,
    };

    // Invoke contract bridge with full transaction lifecycle
    const result = await contractMintWrap(mintOptions);

    useTransactionStore.getState().setTransactionState("confirmed");
    useTransactionStore.getState().setTransactionHash(result.transactionHash);

    return result.transactionHash;
  } catch (error) {
    if (
      error instanceof ContractConfigurationError ||
      error instanceof InvalidContractAddressError ||
      error instanceof ContractNotFoundError ||
      error instanceof ContractValidationError
    ) {
      throw error;
    }
    if (error instanceof Error) {
      useTransactionStore.getState().setTransactionState("failed");
      // Prefer friendly mapped copy when the error still carries a host Contract #code
      const mapped = mapContractError(error);
      const userMessage =
        mapped.code !== "Unknown" ? mapped.userMessage : error.message;
      log.error("mint failed", { code: mapped.code, raw: mapped.raw });
      useTransactionStore.getState().setTransactionError(userMessage);
      throw new Error(`Minting failed: ${userMessage}`);
    }
    const genericError = new Error("Minting failed: Unknown error occurred");
    useTransactionStore.getState().setTransactionState("failed");
    useTransactionStore.getState().setTransactionError(genericError.message);
    throw genericError;
  }
}