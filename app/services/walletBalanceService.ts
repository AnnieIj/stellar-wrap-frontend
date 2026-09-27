/**
 * Wallet Balance Service
 * Fetches and processes wallet asset balances from Horizon
 */

import { getHorizonServer } from "../utils/stellarClient";
import type { WalletAsset } from "../store/assetListStore";

export interface FetchWalletBalancesOptions {
  address: string;
  network: "mainnet" | "testnet";
}

/**
 * Fetches all asset balances for a given wallet address from Horizon
 */
export async function fetchWalletBalances(
  options: FetchWalletBalancesOptions,
): Promise<WalletAsset[]> {
  const { address, network } = options;

  try {
    const server = getHorizonServer(network);
    const account = await server.loadAccount(address);

    const assets: WalletAsset[] = [];
    
    for (const balance of account.balances) {
      if (balance.asset_type === "native") {
        assets.push({
          code: "XLM",
          balance: balance.balance,
          assetType: "native",
        });
      } else if (balance.asset_type === "credit_alphanum4" || balance.asset_type === "credit_alphanum12") {
        const creditBalance = balance as {
          asset_code: string;
          asset_issuer: string;
          balance: string;
          asset_type: "credit_alphanum4" | "credit_alphanum12";
        };
        assets.push({
          code: creditBalance.asset_code,
          issuer: creditBalance.asset_issuer,
          balance: creditBalance.balance,
          assetType: creditBalance.asset_type,
        });
      }
      // Skip liquidity pools and other unsupported types
    }

    return assets;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch wallet balances";
    throw new Error(errorMessage);
  }
}

/**
 * Formats a Stellar balance string to a human-readable number
 * Handles the 7 decimal precision (stroops) for Stellar
 */
export function formatStellarBalance(balance: string): string {
  const num = parseFloat(balance);
  if (isNaN(num)) return "0";

  // Stellar uses 7 decimal places (stroops)
  return num.toFixed(7);
}

/**
 * Converts a balance string to a number for calculations
 */
export function balanceToNumber(balance: string): number {
  return parseFloat(balance) || 0;
}

/**
 * Filters assets based on the selected filter option
 */
export function filterAssets(
  assets: WalletAsset[],
  filter: "all" | "native" | "custom",
): WalletAsset[] {
  switch (filter) {
    case "native":
      return assets.filter((asset) => asset.assetType === "native");
    case "custom":
      return assets.filter((asset) => asset.assetType !== "native");
    default:
      return assets;
  }
}

/**
 * Sorts assets based on the selected sort option
 */
export function sortAssets(
  assets: WalletAsset[],
  sortBy: "balance-desc" | "balance-asc" | "code-asc" | "code-desc",
): WalletAsset[] {
  const sorted = [...assets];

  switch (sortBy) {
    case "balance-desc":
      return sorted.sort(
        (a, b) => balanceToNumber(b.balance) - balanceToNumber(a.balance),
      );
    case "balance-asc":
      return sorted.sort(
        (a, b) => balanceToNumber(a.balance) - balanceToNumber(b.balance),
      );
    case "code-asc":
      return sorted.sort((a, b) => a.code.localeCompare(b.code));
    case "code-desc":
      return sorted.sort((a, b) => b.code.localeCompare(a.code));
    default:
      return sorted;
  }
}

/**
 * Generates a unique key for an asset (used for selection tracking)
 */
export function getAssetKey(asset: WalletAsset): string {
  if (asset.assetType === "native") {
    return "native";
  }
  return `${asset.code}-${asset.issuer}`;
}
