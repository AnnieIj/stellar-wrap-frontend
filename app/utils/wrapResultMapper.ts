import { mockData } from "@/app/data/mockData";
import type { DappInfo, IndexerResult } from "@/app/utils/indexer";
import type { WrapResult } from "@/app/store/wrapStore";

function mapIndexerDapps(dapps: DappInfo[]) {
  return dapps.map((dapp) => ({
    name: dapp.name,
    icon: dapp.icon,
    interactions: dapp.transactionCount,
  }));
}

function mapMockDapps() {
  return mockData.dapps.map((dapp) => ({
    name: dapp.name,
    interactions: dapp.transactions,
    color: dapp.color,
    gradient: dapp.gradient,
  }));
}

export function mapIndexerResultToWrapResult(
  indexerResult: IndexerResult,
): WrapResult {
  const isZeroActivity = indexerResult.totalTransactions === 0;
  // Prefer the computed persona from the indexer; fall back to mockData only if absent.
  const persona = indexerResult.persona ?? (isZeroActivity ? "Quiet Wallet" : mockData.persona);

  return {
    username: mockData.username,
    // Preserve legitimate zeros — do not coerce to mock transaction counts.
    totalTransactions: indexerResult.totalTransactions ?? 0,
    percentile: isZeroActivity ? 0 : mockData.percentile,
    dapps: isZeroActivity
      ? []
      : indexerResult.dapps?.length
        ? mapIndexerDapps(indexerResult.dapps)
        : mapMockDapps(),
    vibes: isZeroActivity ? [] : mockData.vibes,
    persona,
    personaDescription: isZeroActivity
      ? "No on-chain activity showed up for this period. Try a wider window or another network."
      : mockData.personaDescription,
    portfolioDiversitySummary: indexerResult.portfolioDiversitySummary,
    biggestDaySummary: indexerResult.biggestDaySummary,
    dexTradingSummary: indexerResult.dexTradingSummary,
    sorobanBuilderSummary: indexerResult.sorobanBuilderSummary,
    nftActivitySummary: indexerResult.nftActivitySummary,
    largestTransaction: indexerResult.largestTransaction,
  };
}

export function getMockWrapResult(): WrapResult {
  return {
    username: mockData.username,
    totalTransactions: mockData.transactions,
    percentile: mockData.percentile,
    dapps: mapMockDapps(),
    vibes: mockData.vibes,
    persona: mockData.persona,
    personaDescription: mockData.personaDescription,
    largestTransaction: { amount: 4250.5, assetCode: "XLM" },
  };
}
