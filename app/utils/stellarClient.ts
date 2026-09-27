/**
 * Stellar Horizon client factory
 * Creates and manages Horizon server instances for different networks
 */

import { Horizon } from "stellar-sdk";
import { NEXT_PUBLIC_RPC_ENDPOINTS } from "./indexer";

type NetworkType = "mainnet" | "testnet";

const horizonServers: Record<NetworkType, Horizon.Server> = {
  mainnet: new Horizon.Server(NEXT_PUBLIC_RPC_ENDPOINTS.mainnet),
  testnet: new Horizon.Server(NEXT_PUBLIC_RPC_ENDPOINTS.testnet),
};

export function getHorizonServer(
  network: NetworkType = "mainnet",
): Horizon.Server {
  return horizonServers[network];
}

export function validateAccountId(accountId: string): boolean {
  try {
    return accountId.startsWith("G") && accountId.length === 56;
  } catch {
    return false;
  }
}
