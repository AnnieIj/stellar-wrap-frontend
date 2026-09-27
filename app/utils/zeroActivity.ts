import type { WrapResult } from "@/app/store/wrapStore";
import type { IndexerResult } from "@/app/utils/indexer";

/**
 * True when an indexer/wrap result has no activity in the selected period.
 */
export function isZeroActivityResult(
  result: Pick<WrapResult, "totalTransactions"> | Pick<IndexerResult, "totalTransactions"> | null | undefined,
): boolean {
  if (!result) {
    return false;
  }
  return result.totalTransactions === 0;
}
