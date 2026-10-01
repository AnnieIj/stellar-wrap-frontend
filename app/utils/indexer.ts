/**
 * Type definitions for Stellar Horizon indexing service
 */

export type WrapPeriod = "weekly" | "biweekly" | "monthly" | "yearly";

export interface DappInfo {
  name: string;
  icon?: string;
  volume: number;
  transactionCount: number;
}

export interface VibeTag {
  tag: string;
  count: number;
}

export interface DexTradingSummary {
  totalVolume: number; // in XLM equivalent
  tradeCount: number;
  mostTradedPair?: string;
  buyCount: number;
  sellCount: number;
}

export interface SorobanDeployment {
  contractId: string;
  deploymentDate: string; // ISO string
  transactionHash: string;
}

export interface SorobanBuilderSummary {
  deployments: SorobanDeployment[];
  deploymentCount: number;
  contractCallCount: number;
  builderScore: number;
}

export interface TopAsset {
  assetCode: string;
  percentage: number;
}

export interface PortfolioDiversitySummary {
  score: number;
  label: string;
  uniqueAssetsCount: number;
  topAssets: TopAsset[];
}

export interface BiggestDaySummary {
  date: string;
  transactionCount: number;
  typeBreakdown: Record<string, number>;
  topActivity: string;
  tagline: string;
  busiestDayOfWeek: string;
}

export interface NftActivitySummary {
  mintCount: number;
  topCreatorAddress: string | null;
  topCreatorMintCount: number;
}

export interface IndexerResult {
  accountId: string;
  totalTransactions: number;
  totalVolume: number;
  mostActiveAsset: string;
  contractCalls: number;
  gasSpent: number;
  dapps: DappInfo[];
  vibes: VibeTag[];
  nftActivitySummary?: NftActivitySummary;
  dexTradingSummary?: DexTradingSummary;
  sorobanBuilderSummary?: SorobanBuilderSummary;
  portfolioDiversitySummary?: PortfolioDiversitySummary;
  biggestDaySummary?: BiggestDaySummary;
  largestTransaction?: { amount: number; assetCode: string };
  /**
   * Computed persona archetype for this account, e.g. "The Yield Farmer".
   * Assigned by detectPersona() in achievementCalculator.
   */
  persona?: string;
}

/** Cache entry version for schema migrations and validation */
export const CACHE_VERSION = 1;

/** Default TTL in minutes (1 hour). Configurable for cache validity. */
export const CACHE_TTL_MINUTES = 60;

export interface CacheEntry {
  result: IndexerResult;
  timestamp: number;
  version?: number;
  /** Raw transactions stored so wider periods can serve narrower cache hits. */
  transactions?: unknown[];
}

export interface CacheStore {
  [key: string]: CacheEntry;
}

export const PERIODS: Record<WrapPeriod, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  yearly: 365,
};

export const NEXT_PUBLIC_RPC_ENDPOINTS = {
  mainnet: "https://horizon.stellar.org",
  testnet: "https://horizon-testnet.stellar.org",
};

/**
 * Normalizes a raw period query-string value into a valid WrapPeriod.
 * Handles casing differences and trims whitespace.
 * Returns `null` when the input cannot be mapped to a known period.
 */
export function normalizePeriod(raw: string | null | undefined): WrapPeriod | null {
  if (raw == null) return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed in PERIODS) return trimmed as WrapPeriod;
  return null;
}

export function getCacheKey(
  accountId: string,
  network: "mainnet" | "testnet",
  period: WrapPeriod,
): string {
  return `${accountId}:${network}:${period}:${CACHE_VERSION}`;
}

export function isCacheValid(
  entry: CacheEntry,
  ttlMinutes: number = CACHE_TTL_MINUTES,
): boolean {
  const now = Date.now();
  const age = now - entry.timestamp;
  return age < ttlMinutes * 60 * 1000;
}

/** Result of indexAccount when cache is used; for UI (badge, age, refresh). */
export interface IndexerResultWithMeta {
  result: IndexerResult;
  fromCache: boolean;
  cacheTimestamp?: number;
  refreshingInBackground?: boolean;
}
