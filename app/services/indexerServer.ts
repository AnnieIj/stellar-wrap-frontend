/**
 * Server-safe account indexing for Next.js API routes.
 * Does not import IndexedDB or other browser-only globals.
 */

import type { IndexerResultWithMeta, WrapPeriod } from "@/app/utils/indexer";
import { runIndexingCore } from "./indexerCore";

/**
 * Index an account for server runtimes (e.g. /api/wrapped).
 * Always fetches live Horizon data — no browser cache.
 */
export async function indexAccount(
  accountId: string,
  network: "mainnet" | "testnet" = "mainnet",
  period: WrapPeriod = "monthly",
): Promise<IndexerResultWithMeta> {
  const { result } = await runIndexingCore(accountId, network, period, false);
  return {
    result,
    fromCache: false,
  };
}
