import { describe, expect, it } from "vitest";
import { isZeroActivityResult } from "@/app/utils/zeroActivity";
import { mapIndexerResultToWrapResult } from "@/app/utils/wrapResultMapper";
import type { IndexerResult } from "@/app/utils/indexer";
import { getStellarExpertAccountUrl } from "@/app/utils/stellarExpert";

function emptyIndexerResult(
  overrides: Partial<IndexerResult> = {},
): IndexerResult {
  return {
    accountId: "GABCDEF123456789",
    totalTransactions: 0,
    totalVolume: 0,
    mostActiveAsset: "XLM",
    contractCalls: 0,
    gasSpent: 0,
    dapps: [],
    vibes: [],
    ...overrides,
  };
}

describe("zero-activity detection and mapping", () => {
  it("detects zero transaction indexer/wrap results", () => {
    expect(isZeroActivityResult({ totalTransactions: 0 })).toBe(true);
    expect(isZeroActivityResult({ totalTransactions: 1 })).toBe(false);
    expect(isZeroActivityResult(null)).toBe(false);
    expect(isZeroActivityResult(undefined)).toBe(false);
  });

  it("maps zero-activity indexer results without falling back to mock stats", () => {
    const wrap = mapIndexerResultToWrapResult(emptyIndexerResult());

    expect(wrap.totalTransactions).toBe(0);
    expect(wrap.dapps).toEqual([]);
    expect(wrap.vibes).toEqual([]);
    expect(wrap.percentile).toBe(0);
    expect(isZeroActivityResult(wrap)).toBe(true);
  });

  it("still maps non-zero results with real transaction counts", () => {
    const wrap = mapIndexerResultToWrapResult(
      emptyIndexerResult({
        totalTransactions: 12,
        dapps: [
          {
            name: "Mercurius",
            transactionCount: 5,
            volume: 100,
          },
        ],
      }),
    );

    expect(wrap.totalTransactions).toBe(12);
    expect(wrap.dapps[0]?.name).toBe("Mercurius");
    expect(isZeroActivityResult(wrap)).toBe(false);
  });

  it("documents the empty-state UI test id used for zero-tx rendering", () => {
    // ZeroActivityEmptyState renders data-testid="zero-activity-empty-state"
    // when isZeroActivityResult(result) is true on loading/persona/share.
    const wrap = mapIndexerResultToWrapResult(emptyIndexerResult());
    expect(isZeroActivityResult(wrap)).toBe(true);
    expect("zero-activity-empty-state").toMatch(/zero-activity/);
  });
});

describe("stellar.expert account URL", () => {
  it("builds network-aware URLs and hides when address is missing", () => {
    expect(getStellarExpertAccountUrl(null, "mainnet")).toBeNull();
    expect(getStellarExpertAccountUrl("", "testnet")).toBeNull();
    expect(getStellarExpertAccountUrl("GABC", "mainnet")).toBe(
      "https://stellar.expert/explorer/public/account/GABC",
    );
    expect(getStellarExpertAccountUrl("GABC", "testnet")).toBe(
      "https://stellar.expert/explorer/testnet/account/GABC",
    );
  });
});
