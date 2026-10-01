/**
 * Mock Indexer Service for Stellar Wrap Issue #36
 *
 * NOTE: This is a placeholder service until Issue #34 (Stellar Horizon API Indexer Service)
 * is fully implemented and merged. It simulates network delay and returns successfully
 * to unblock frontend development of indexing feedback states.
 */

import { logger, maskAddress } from "@/app/utils/logger";

const log = logger.child("indexerService");

class IndexerService {
  /**
   * Simulates fetching and indexing an account's transactions.
   * @param address The Stellar public key to index
   * @returns Promise that resolves when indexing is "complete"
   */
  async fetchAccountTransactions(address: string): Promise<void> {
    // Address logged only at debug level (or masked for higher levels)
    log.debug(`Starting indexing for address: ${address}`);

    // Simulate a network delay (e.g., 2.5 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Randomly fail sometimes for testing error states (uncomment to test)
    // if (Math.random() < 0.2) {
    //  throw new Error("Simulated indexing failure");
    // }

    log.debug(`Finished indexing for address: ${address}`);
    log.info(`Finished indexing for address ${maskAddress(address)}`);
    return Promise.resolve();
  }
}

export const indexerService = new IndexerService();
