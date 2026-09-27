import type { Network } from "@/src/config";

/**
 * Build a network-aware Stellar.expert account explorer URL.
 * Returns null when address is missing.
 */
export function getStellarExpertAccountUrl(
  address: string | null | undefined,
  network: Network | "mainnet" | "testnet",
): string | null {
  if (!address) {
    return null;
  }

  const explorerNetwork = network === "testnet" ? "testnet" : "public";
  return `https://stellar.expert/explorer/${explorerNetwork}/account/${address}`;
}
