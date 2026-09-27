/**
 * Network-aware contract bridge: loads Soroban contract by network,
 * caches instance per network, and clears cache on network switch.
 */

import { Contract } from "stellar-sdk";
import { Network, isValidNetwork } from "../../src/config";
import {
  getContractAddress,
  isValidContractAddress,
  isPlaceholderContractAddress,
} from "../../config/contracts";
import {
  ContractConfigurationError,
  InvalidContractAddressError,
  ContractNotFoundError,
  PlaceholderContractError,
} from "./contractErrors";

/** Contract instance cache per network */
const contractInstanceCache: Partial<Record<Network, Contract>> = {};

/**
 * Get Soroban Contract instance for the given network.
 * Uses cached instance when available; creates and caches when not.
 *
 * @param network - 'mainnet' | 'testnet'
 * @returns Contract instance for invoking methods (e.g. mint_wrap)
 * @throws InvalidContractAddressError when address format is invalid
 * @throws ContractConfigurationError when network is invalid
 */
export function getContractInstance(network: Network): Contract {
  if (!isValidNetwork(network)) {
    throw new ContractConfigurationError(`Invalid network: ${network}`);
  }

  const cached = contractInstanceCache[network];
  if (cached) {
    return cached;
  }

  // getContractAddress already rejects placeholders; double-check for defense in depth
  const address = getContractAddress(network);
  if (!isValidContractAddress(address)) {
    throw new InvalidContractAddressError(address, network);
  }
  if (isPlaceholderContractAddress(address)) {
    throw new PlaceholderContractError(network);
  }

  try {
    const contract = new Contract(address);
    contractInstanceCache[network] = contract;
    return contract;
  } catch (err) {
    if (
      err instanceof PlaceholderContractError ||
      (err && typeof err === "object" && "name" in err && err.name === "PlaceholderContractAddressError")
    ) {
      throw err;
    }
    throw new ContractNotFoundError(network, err);
  }
}

/**
 * Get contract address for the given network (no cache).
 * Use this when you only need the address (e.g. display, explorer links).
 */
export function getContractAddressForNetwork(network: Network): string {
  return getContractAddress(network);
}

/**
 * Clear cached contract instances. Call when the user switches network
 * so the next getContractInstance uses the new network's address.
 */
export function clearContractCache(): void {
  (Object.keys(contractInstanceCache) as Network[]).forEach((key) => {
    delete contractInstanceCache[key];
  });
}

/**
 * Check if we have a cached contract for a network (for loading state).
 */
export function hasCachedContract(network: Network): boolean {
  return isValidNetwork(network) && network in contractInstanceCache;
}

/**
 * Get contract instance and optionally validate it exists on network (Soroban RPC).
 * Use when you need to ensure the contract is deployed before use.
 */
export async function getContractInstanceValidated(
  network: Network
): Promise<Contract> {
  const { validateContractOnNetwork } = await import("./contractValidation");
  await validateContractOnNetwork(network);
  return getContractInstance(network);
}
