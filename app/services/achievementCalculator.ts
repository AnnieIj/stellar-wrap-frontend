/**
 * Achievement calculator
 * Processes transaction data to calculate user metrics and achievements
 * 
 * Categories transactions by type (payments, swaps, contract calls)
 * Calculates volumes, tracks assets, detects contract interactions
 * Groups transactions by timeframe for analysis
 */

import { IndexerResult, DappInfo, VibeTag, DexTradingSummary, SorobanDeployment, SorobanBuilderSummary, NftActivitySummary, PortfolioDiversitySummary, BiggestDaySummary, TopAsset } from "@/app/utils/indexer";

interface DailyStats {
  txCount: number;
  categories: Record<string, number>;
}

/**
 * Raw transaction from Horizon API
 */
interface Transaction {
  id?: string;
  created_at: string;
  memo?: string;
  memo_type?: string;
  operations?: Operation[];
  successful?: boolean;
  fee_charged?: string;
}

/**
 * Operation within a transaction
 */
interface Operation {
  type: string;
  amount?: string;
  asset_code?: string;
  asset_type?: string;
  from?: string;
  to?: string;
  asset_issuer?: string;
  source_amount?: string;
  destination_amount?: string;
  destination_asset_code?: string;
  source_asset_code?: string;
  memo?: string;
  contract?: string;
  contract_id?: string;
  function?: string;
}

/**
 * Transaction categorization by type
 */
interface TransactionCategories {
  payments: number;
  swaps: number;
  contractCalls: number;
  offers: number;
  trustlines: number;
  other: number;
}

export type PersonaArchetype =
  | "The Architect"
  | "The Patron"
  | "The Collector"
  | "The Trader"
  | "The Wizard"
  | "The Explorer";

export interface PersonaAssignmentInput {
  categories: TransactionCategories;
  deploymentCount: number;
  contractCallCount: number;
  defiTraderCount: number;
  dexTradeCount: number;
  totalVolume: number;
  txCount: number;
}

/**
 * DApp detection keywords for common platforms
 */
const DAPP_KEYWORDS = {
  "stellar.expert": { name: "Stellar Expert", icon: "📊" },
  "stellarx": { name: "StellarX", icon: "📈" },
  "aqua": { name: "Aqua", icon: "💧" },
  "lobstr": { name: "LOBSTR", icon: "🦞" },
  soroban: { name: "Soroban", icon: "⚡" },
  swap: { name: "DEX", icon: "🔄" },
  lp: { name: "Liquidity Pool", icon: "💧" },
  bridge: { name: "Bridge", icon: "🌉" },
  payment: { name: "Payments", icon: "💳" },
};

// ─── Thresholds for persona detection ───────────────────────────────────────

/**
 * Minimum number of DEX operations (offers + path payments combined) required
 * to qualify as a Yield Farmer.
 */
const YIELD_FARMER_MIN_DEX_OPS = 10;

/**
 * Minimum number of distinct LP-related asset trustlines required to qualify
 * as a Yield Farmer (change_trust operations involving non-XLM assets indicate
 * LP pool token participation).
 */
const YIELD_FARMER_MIN_LP_TRUSTLINES = 2;

/**
 * Maximum total transaction count for a Hodler persona. Hodlers interact with
 * the network rarely — mostly just receiving/sending XLM.
 */
const HODLER_MAX_TX_COUNT = 20;

/**
 * Hodlers must also have very few DEX operations to distinguish them from
 * low-activity traders.
 */
const HODLER_MAX_DEX_OPS = 3;

// ─── Persona detection ───────────────────────────────────────────────────────

/**
 * Persona metrics extracted during transaction processing.
 */
interface PersonaMetrics {
  dexOpCount: number;       // offers + path payments
  lpTrustlineCount: number; // change_trust with non-native assets
  totalTransactions: number;
  contractCalls: number;
}

/**
 * Determine the best-fit persona archetype from transaction metrics.
 *
 * Priority (highest to lowest):
 *   1. The Yield Farmer  — many DEX ops AND multiple LP trustlines
 *   2. The Hodler        — very few transactions AND very few DEX ops
 *   3. The Wizard        — many Soroban contract calls (fallback kept for
 *                          backwards-compat with existing logic)
 *   4. The Explorer      — default when nothing else matches
 */
export function detectPersona(metrics: PersonaMetrics): string {
  const { dexOpCount, lpTrustlineCount, totalTransactions, contractCalls } = metrics;

  if (
    dexOpCount >= YIELD_FARMER_MIN_DEX_OPS &&
    lpTrustlineCount >= YIELD_FARMER_MIN_LP_TRUSTLINES
  ) {
    return "The Yield Farmer";
  }

  if (
    totalTransactions <= HODLER_MAX_TX_COUNT &&
    dexOpCount <= HODLER_MAX_DEX_OPS &&
    totalTransactions > 0
  ) {
    return "The Hodler";
  }

  if (contractCalls > 10) {
    return "The Wizard";
  }

  return "The Explorer";
}

/**
 * Main achievement calculation function
 * Analyzes transactions and returns comprehensive metrics
 * 
 * @param transactions Array of transaction records from Horizon API
 * @returns IndexerResult with calculated achievements and metrics
 */
export function calculateAchievements(
  transactions: Transaction[],
): IndexerResult {
  // Handle empty transaction array
  if (!transactions || transactions.length === 0) {
    return {
      accountId: "",
      totalTransactions: 0,
      totalVolume: 0,
      mostActiveAsset: "XLM",
      contractCalls: 0,
      gasSpent: 0,
      dapps: [],
      vibes: [{ tag: "Getting Started", count: 0 }],
      persona: "The Explorer",
      nftActivitySummary: {
        mintCount: 0,
        topCreatorAddress: null,
        topCreatorMintCount: 0,
      },
      dexTradingSummary: {
        totalVolume: 0,
        tradeCount: 0,
        buyCount: 0,
        sellCount: 0,
      },
      sorobanBuilderSummary: {
        deployments: [],
        deploymentCount: 0,
        contractCallCount: 0,
        builderScore: 0,
      },
      portfolioDiversitySummary: {
        score: 0,
        label: "Mono-asset",
        uniqueAssetsCount: 0,
        topAssets: [],
      },
      biggestDaySummary: {
        date: "",
        transactionCount: 0,
        typeBreakdown: {},
        topActivity: "None",
        tagline: "A chill day on Stellar",
        busiestDayOfWeek: "None",
      },
    };
  }

  // Initialize trackers
  let totalVolume = 0;
  let totalGasSpent = 0;
  let successfulTxCount = 0;
  const assetMap = new Map<string, number>(); // asset -> operation count
  const assetVolumeMap = new Map<string, number>(); // asset -> total volume
  const dappMap = new Map<string, DappInfo>();
  const vibeMap = new Map<string, number>();
  const categories: TransactionCategories = {
    payments: 0,
    swaps: 0,
    contractCalls: 0,
    offers: 0,
    trustlines: 0,
    other: 0,
  };

  // DEX trading summary trackers
  const dexTrackers = {
    totalVolume: 0,
    tradeCount: 0,
    buyCount: 0,
    sellCount: 0,
    pairMap: new Map<string, number>(), // pair -> trade count
  };

  // Soroban builder summary trackers
  const sorobanTrackers = {
    deployments: [] as SorobanDeployment[],
    contractCallCount: 0,
  };

  // Persona metrics trackers
  const personaMetrics: PersonaMetrics = {
    dexOpCount: 0,       // offers + path payments
    lpTrustlineCount: 0, // change_trust with non-native assets (LP tokens)
    totalTransactions: 0,
    contractCalls: 0,
  };

  // NFT activity trackers
  let nftMintCount = 0;
  const nftCreatorMap = new Map<string, number>(); // creator address -> mint count

  // Additional metrics tracking
  let largestTransaction = 0;
  let largestTransactionAsset = "XLM";
  const counterparties = new Set<string>();
  
  const dailyStats = new Map<string, DailyStats>();
  const dayOfWeekCount = new Array(7).fill(0);

  // Process each transaction
  transactions.forEach((tx: Transaction) => {
    // Skip invalid or failed transactions
    if (tx.successful === false) return;
    successfulTxCount++;
    personaMetrics.totalTransactions = successfulTxCount;

    // Track gas spent
    if (tx.fee_charged) {
      totalGasSpent += parseFloat(tx.fee_charged) / 10000000; // Convert stroops to XLM
    }

    // Track daily activity
    const dateObj = new Date(tx.created_at);
    const txDate = dateObj.toISOString().split('T')[0];
    if (!dailyStats.has(txDate)) {
      dailyStats.set(txDate, { txCount: 0, categories: {} });
    }
    const dayStat = dailyStats.get(txDate)!;
    dayStat.txCount++;
    dayOfWeekCount[dateObj.getDay()]++;

    if (!tx.operations || tx.operations.length === 0) return;

    // Process each operation in the transaction
    tx.operations.forEach((op: Operation) => {
      const operationType = op.type;

      // Categorize operation type
      switch (operationType) {
        case "payment":
        case "create_account":
          categories.payments++;
          dayStat.categories.payments = (dayStat.categories.payments || 0) + 1;
          processPaymentOperation(op, tx, assetMap, assetVolumeMap, dappMap, counterparties);
          break;

        case "path_payment_strict_receive":
        case "path_payment_strict_send":
          categories.swaps++;
          dayStat.categories.swaps = (dayStat.categories.swaps || 0) + 1;
          processPathPaymentOperation(op, assetMap, assetVolumeMap, vibeMap, dexTrackers);
          personaMetrics.dexOpCount++;
          break;

        case "invoke_host_function": {
          categories.contractCalls++;
          personaMetrics.contractCalls++;
          dayStat.categories.contractCalls = (dayStat.categories.contractCalls || 0) + 1;
          // Detect deployment: no explicit function call, or create/wasm keywords in function
          const fnName = (op.function || "").toLowerCase();
          const isDeployment =
            !op.function ||
            fnName.includes("create") ||
            fnName.includes("deploy") ||
            fnName.includes("wasm");
          processContractOperation(op, dappMap, isDeployment, sorobanTrackers, tx);
          if (isDeployment) {
            vibeMap.set("soroban-user", (vibeMap.get("soroban-user") || 0) + 5);
          } else {
            vibeMap.set("soroban-user", (vibeMap.get("soroban-user") || 0) + 1);
          }
          // Detect NFT mint operations via Soroban (mint / mint_to / mint_wrap / create_nft)
          const isNftMint =
            fnName.includes("mint") ||
            fnName.includes("create_nft") ||
            fnName.includes("nft_mint");
          if (isNftMint) {
            nftMintCount++;
            const creator = op.contract_id || op.contract || op.from || "";
            if (creator) {
              nftCreatorMap.set(creator, (nftCreatorMap.get(creator) || 0) + 1);
            }
            vibeMap.set("nft-collector", (vibeMap.get("nft-collector") || 0) + 1);
          }
          break;
        }

        case "extend_footprint_ttl":
        case "restore_footprint":
          categories.contractCalls++;
          dayStat.categories.contractCalls = (dayStat.categories.contractCalls || 0) + 1;
          sorobanTrackers.contractCallCount++;
          vibeMap.set("soroban-user", (vibeMap.get("soroban-user") || 0) + 1);
          break;

        case "manage_buy_offer":
        case "manage_sell_offer":
        case "create_passive_sell_offer":
          categories.offers++;
          dayStat.categories.offers = (dayStat.categories.offers || 0) + 1;
          processOfferOperation(op, assetMap, assetVolumeMap, vibeMap, dexTrackers);
          personaMetrics.dexOpCount++;
          break;

        case "change_trust":
        case "allow_trust":
        case "set_trust_line_flags": {
          categories.trustlines++;
          dayStat.categories.trustlines = (dayStat.categories.trustlines || 0) + 1;
          // Detect potential NFT collection: trustline to a non-native, non-LP asset
          const asset = op.asset_code;
          const issuer = op.asset_issuer;
          if (asset && issuer && asset.toUpperCase() !== "XLM") {
            // Count unique trustlines to issuers as potential NFT collections
            // Skip common LP / pool tokens
            const isLikelyLP =
              asset.toLowerCase().includes("lp") ||
              asset.toLowerCase().includes("pool");
            if (!isLikelyLP) {
              nftMintCount++;
              nftCreatorMap.set(issuer, (nftCreatorMap.get(issuer) || 0) + 1);
              vibeMap.set("nft-collector", (vibeMap.get("nft-collector") || 0) + 1);
            } else {
              personaMetrics.lpTrustlineCount++;
            }
          }
          break;
        }

        default:
          categories.other++;
          dayStat.categories.other = (dayStat.categories.other || 0) + 1;
      }

      // Track largest transaction
      const amount = parseFloat(op.amount || op.source_amount || op.destination_amount || "0");
      if (amount > largestTransaction) {
        largestTransaction = amount;
        largestTransactionAsset =
          op.asset_code || op.destination_asset_code || op.source_asset_code || "XLM";
      }
    });
  });

  // Calculate total volume from asset volumes
  assetVolumeMap.forEach((volume) => {
    totalVolume += volume;
  });

  // Determine most active asset by total volume, fallback to operation count when tied
  let mostActiveAsset = "XLM";
  let maxVolume = 0;
  let maxCount = 0;
  assetVolumeMap.forEach((volume, asset) => {
    const opCount = assetMap.get(asset) || 0;
    if (volume > maxVolume || (volume === maxVolume && opCount > maxCount)) {
      maxVolume = volume;
      maxCount = opCount;
      mostActiveAsset = asset;
    }
  });
  // Fallback: if no volumes tracked, use operation count ranking
  if (maxVolume === 0) {
    assetMap.forEach((count, asset) => {
      if (count > maxCount) {
        maxCount = count;
        mostActiveAsset = asset;
      }
    });
  }

  // Generate vibe tags based on activity patterns
  const vibes = generateVibes(
    successfulTxCount,
    totalVolume,
    categories.contractCalls,
    vibeMap,
    assetMap,
  );

  // Determine persona archetype
  const defiTraderCount = vibeMap.get("defi-trader") || 0;
  const deploymentCount = sorobanTrackers.deployments.length;
  const persona = assignPersona({
    categories,
    deploymentCount,
    contractCallCount: categories.contractCalls,
    defiTraderCount,
    dexTradeCount: dexTrackers.tradeCount,
    totalVolume,
    txCount: successfulTxCount,
  });

  // Build summaries
  const dexTradingSummary = buildDexTradingSummary(dexTrackers);
  const sorobanBuilderSummary = buildSorobanBuilderSummary(sorobanTrackers);
  const nftActivitySummary = buildNftActivitySummary(nftMintCount, nftCreatorMap);
  const portfolioDiversitySummary = buildPortfolioDiversitySummary(assetMap, assetVolumeMap, totalVolume);
  const biggestDaySummary = buildBiggestDaySummary(dailyStats, dayOfWeekCount);

  return {
    accountId: "",
    totalTransactions: successfulTxCount,
    totalVolume,
    mostActiveAsset,
    contractCalls: categories.contractCalls,
    gasSpent: totalGasSpent,
    dapps: Array.from(dappMap.values()).sort(
      (a, b) => b.transactionCount - a.transactionCount || b.volume - a.volume,
    ),
    vibes,
    persona,
    nftActivitySummary,
    dexTradingSummary,
    sorobanBuilderSummary,
    portfolioDiversitySummary,
    biggestDaySummary,
    largestTransaction: largestTransaction > 0 ? { amount: largestTransaction, assetCode: largestTransactionAsset } : undefined,
  };
}

/**
 * Track Soroban contract interactions as dApp entries (address used when name is unknown).
 */
function processContractOperation(
  op: Operation,
  dappMap: Map<string, DappInfo>,
  isDeployment: boolean,
  sorobanTrackers: { deployments: SorobanDeployment[], contractCallCount: number },
  tx: Transaction,
): void {
  const contractId = op.contract_id || op.contract;
  if (!contractId) {
    if (!isDeployment) sorobanTrackers.contractCallCount++;
    return;
  }

  const existing = dappMap.get(contractId) || {
    name: contractId,
    icon: "📜",
    volume: 0,
    transactionCount: 0,
  };
  existing.transactionCount += 1;
  dappMap.set(contractId, existing);

  if (isDeployment) {
    sorobanTrackers.deployments.push({
      contractId: contractId,
      deploymentDate: tx.created_at,
      transactionHash: tx.id || "",
    });
  } else {
    sorobanTrackers.contractCallCount++;
  }
}

/**
 * Process payment operation to track volume and assets
 */
function processPaymentOperation(
  op: Operation,
  tx: Transaction,
  assetMap: Map<string, number>,
  assetVolumeMap: Map<string, number>,
  dappMap: Map<string, DappInfo>,
  counterparties: Set<string>,
): void {
  const amount = op.amount ? parseFloat(op.amount) : 0;
  const asset = op.asset_code || "XLM";

  // Track asset usage
  assetMap.set(asset, (assetMap.get(asset) || 0) + 1);
  assetVolumeMap.set(asset, (assetVolumeMap.get(asset) || 0) + amount);

  // Track counterparties
  if (op.from) counterparties.add(op.from);
  if (op.to) counterparties.add(op.to);

  // Detect dapps from memo
  const memo = (op.memo || tx.memo || "").toLowerCase();
  if (memo) {
    Object.entries(DAPP_KEYWORDS).forEach(([keyword, dapp]) => {
      if (memo.includes(keyword)) {
        const key = dapp.name;
        const existing = dappMap.get(key) || {
          name: key,
          icon: dapp.icon,
          volume: 0,
          transactionCount: 0,
        };
        existing.volume += amount;
        existing.transactionCount += 1;
        dappMap.set(key, existing);
      }
    });
  }
}

/**
 * Process path payment (swap) operation
 */
function processPathPaymentOperation(
  op: Operation,
  assetMap: Map<string, number>,
  assetVolumeMap: Map<string, number>,
  vibeMap: Map<string, number>,
  dexTrackers: { totalVolume: number; tradeCount: number; buyCount: number; sellCount: number; pairMap: Map<string, number> },
): void {
  const sourceAmount = op.source_amount ? parseFloat(op.source_amount) : 0;
  const destAmount = op.destination_amount ? parseFloat(op.destination_amount) : 0;
  const plainAmount = op.amount ? parseFloat(op.amount) : 0;
  const sourceAsset = op.source_asset_code || "XLM";
  const destAsset = op.destination_asset_code || "XLM";
  const plainAsset = op.asset_code;

  const hasSpecificAmounts = sourceAmount > 0 || destAmount > 0;
  const singleAsset = plainAsset || sourceAsset || destAsset;

  if (hasSpecificAmounts) {
    assetMap.set(sourceAsset, (assetMap.get(sourceAsset) || 0) + 1);
    assetMap.set(destAsset, (assetMap.get(destAsset) || 0) + 1);
    if (sourceAmount > 0) {
      assetVolumeMap.set(sourceAsset, (assetVolumeMap.get(sourceAsset) || 0) + sourceAmount);
    }
    if (destAmount > 0) {
      assetVolumeMap.set(destAsset, (assetVolumeMap.get(destAsset) || 0) + destAmount);
    }
  } else if (plainAmount > 0) {
    assetMap.set(singleAsset, (assetMap.get(singleAsset) || 0) + 1);
    assetVolumeMap.set(singleAsset, (assetVolumeMap.get(singleAsset) || 0) + plainAmount);
  } else {
    assetMap.set(sourceAsset, (assetMap.get(sourceAsset) || 0) + 1);
    assetMap.set(destAsset, (assetMap.get(destAsset) || 0) + 1);
  }

  const pair = [sourceAsset, destAsset].sort().join("/");
  dexTrackers.pairMap.set(pair, (dexTrackers.pairMap.get(pair) || 0) + 1);
  if (sourceAmount > 0) {
    dexTrackers.totalVolume += sourceAmount;
  } else if (plainAmount > 0) {
    dexTrackers.totalVolume += plainAmount;
  } else {
    dexTrackers.totalVolume += destAmount;
  }
  dexTrackers.tradeCount += 1;
  dexTrackers.buyCount += 1;
  dexTrackers.sellCount += 1;

  vibeMap.set("bridge-warrior", (vibeMap.get("bridge-warrior") || 0) + 1);
}

/**
 * Process offer (trading) operation
 */
function processOfferOperation(
  op: Operation,
  assetMap: Map<string, number>,
  assetVolumeMap: Map<string, number>,
  vibeMap: Map<string, number>,
  dexTrackers: { totalVolume: number; tradeCount: number; buyCount: number; sellCount: number; pairMap: Map<string, number> },
): void {
  const asset = op.asset_code || "XLM";
  const amount = op.amount ? parseFloat(op.amount) : 0;
  assetMap.set(asset, (assetMap.get(asset) || 0) + 1);
  assetVolumeMap.set(asset, (assetVolumeMap.get(asset) || 0) + amount);
  vibeMap.set("defi-trader", (vibeMap.get("defi-trader") || 0) + 1);

  // Track DEX summary
  dexTrackers.tradeCount += 1;
  dexTrackers.totalVolume += amount;
  if (op.type === "manage_buy_offer") {
    dexTrackers.buyCount += 1;
  } else {
    dexTrackers.sellCount += 1;
  }
}

/**
 * Assign a persona archetype based on dominant on-chain activity patterns.
 */
export function assignPersona(input: PersonaAssignmentInput): PersonaArchetype {
  const {
    categories,
    deploymentCount,
    contractCallCount,
    defiTraderCount,
    dexTradeCount,
    totalVolume,
    txCount,
  } = input;

  // Soroban Architect: contract deployments or sustained Soroban builder activity
  if (deploymentCount > 0 || contractCallCount >= 5) {
    return "The Architect";
  }

  // DeFi Patron: sustained liquidity and DEX offer activity
  if (defiTraderCount > 10 || dexTradeCount > 8) {
    return "The Patron";
  }

  // Diamond Hand / Collector: trustline accumulation with minimal trading
  if (
    categories.trustlines >= 3 &&
    categories.swaps + categories.offers < categories.trustlines
  ) {
    return "The Collector";
  }

  // Active swap and offer activity
  if (categories.swaps + categories.offers >= 5) {
    return "The Trader";
  }

  // High-volume or very active accounts
  if (totalVolume > 100_000 || txCount > 100) {
    return "The Wizard";
  }

  return "The Explorer";
}

function buildDexTradingSummary(
  dexTrackers: {
    totalVolume: number;
    tradeCount: number;
    buyCount: number;
    sellCount: number;
    pairMap: Map<string, number>;
  },
): DexTradingSummary {
  let mostTradedPair: string | undefined;
  let maxPairCount = 0;
  dexTrackers.pairMap.forEach((count, pair) => {
    if (count > maxPairCount) {
      maxPairCount = count;
      mostTradedPair = pair;
    }
  });

  return {
    totalVolume: dexTrackers.totalVolume,
    tradeCount: dexTrackers.tradeCount,
    buyCount: dexTrackers.buyCount,
    sellCount: dexTrackers.sellCount,
    ...(mostTradedPair ? { mostTradedPair } : {}),
  };
}

function buildSorobanBuilderSummary(
  sorobanTrackers: {
    deployments: SorobanDeployment[];
    contractCallCount: number;
  },
): SorobanBuilderSummary {
  const deploymentCount = sorobanTrackers.deployments.length;
  const contractCallCount = sorobanTrackers.contractCallCount;
  const builderScore = deploymentCount * 100 + Math.floor(contractCallCount / 10);

  return {
    deployments: sorobanTrackers.deployments,
    deploymentCount,
    contractCallCount,
    builderScore,
  };
}

function buildNftActivitySummary(
  mintCount: number,
  creatorMap: Map<string, number>,
): NftActivitySummary {
  let topCreatorAddress: string | null = null;
  let topCreatorMintCount = 0;

  creatorMap.forEach((count, address) => {
    if (count > topCreatorMintCount) {
      topCreatorMintCount = count;
      topCreatorAddress = address;
    }
  });

  return {
    mintCount,
    topCreatorAddress,
    topCreatorMintCount,
  };
}

function buildPortfolioDiversitySummary(
  assetMap: Map<string, number>,
  assetVolumeMap: Map<string, number>,
  totalVolume: number,
): PortfolioDiversitySummary {
  const uniqueAssetsCount = assetMap.size;

  let score = 0;
  let label = "Mono-asset";
  if (uniqueAssetsCount >= 10) {
    score = 95;
    label = "Rainbow Collector";
  } else if (uniqueAssetsCount >= 6) {
    score = 75;
    label = "Diversified";
  } else if (uniqueAssetsCount >= 3) {
    score = 50;
    label = "Multi-asset";
  } else if (uniqueAssetsCount >= 2) {
    score = 25;
    label = "Bi-asset";
  }

  const topAssets: TopAsset[] = [];
  if (totalVolume > 0) {
    const sortedByVolume = Array.from(assetVolumeMap.entries()).sort(
      (a, b) => b[1] - a[1],
    );
    for (let i = 0; i < Math.min(5, sortedByVolume.length); i++) {
      const [asset, vol] = sortedByVolume[i];
      const percentage = Math.round((vol / totalVolume) * 100) || 1;
      topAssets.push({ assetCode: asset, percentage });
    }
  }

  return {
    score,
    label,
    uniqueAssetsCount,
    topAssets,
  };
}

function buildBiggestDaySummary(
  dailyStats: Map<string, DailyStats>,
  dayOfWeekCount: number[],
): BiggestDaySummary {
  let biggestDate = "";
  let biggestTxCount = 0;
  let biggestBreakdown: Record<string, number> = {};

  dailyStats.forEach((stat, date) => {
    if (stat.txCount > biggestTxCount) {
      biggestTxCount = stat.txCount;
      biggestDate = date;
      biggestBreakdown = stat.categories;
    }
  });

  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let busiestDayOfWeek = "None";
  let maxDay = 0;
  for (let i = 0; i < 7; i++) {
    if (dayOfWeekCount[i] > maxDay) {
      maxDay = dayOfWeekCount[i];
      busiestDayOfWeek = DAYS[i];
    }
  }

  let topActivity = "None";
  let maxCat = 0;
  Object.entries(biggestBreakdown).forEach(([key, val]) => {
    if (val > maxCat) {
      maxCat = val;
      topActivity = key;
    }
  });

  const activityLabels: Record<string, string> = {
    payments: "Payments",
    swaps: "Swaps",
    offers: "DEX Offers",
    contractCalls: "Contract Calls",
    trustlines: "Trustlines",
    other: "Other",
  };
  const topActivityLabel = activityLabels[topActivity] || "Mixed Activity";

  const taglines = [
    "A wild day on-chain",
    "You were cooking 🔥",
    "Peak Stellar activity",
    "The day you went ham",
  ];
  const tagline =
    biggestTxCount > 20
      ? taglines[Math.floor(Math.random() * taglines.length)]
      : biggestTxCount > 5
      ? "A productive day on Stellar"
      : "A chill day on Stellar";

  return {
    date: biggestDate,
    transactionCount: biggestTxCount,
    typeBreakdown: biggestBreakdown,
    topActivity: topActivityLabel,
    tagline,
    busiestDayOfWeek,
  };
}

/**
 * Generate vibe tags based on user activity patterns
 */
export function generateVibes(
  txCount: number,
  totalVolume: number,
  contractCalls: number,
  vibeMap: Map<string, number>,
  assetMap: Map<string, number>,
): VibeTag[] {
  const vibes: VibeTag[] = [];

  // Volume-based vibes
  if (totalVolume > 1000000) {
    vibes.push({ tag: "Whale", count: txCount });
  } else if (totalVolume > 100000) {
    vibes.push({ tag: "High Roller", count: txCount });
  } else if (totalVolume > 10000) {
    vibes.push({ tag: "Active Trader", count: txCount });
  }

  // Transaction frequency vibes
  if (txCount > 500) {
    vibes.push({ tag: "Power User", count: txCount });
  } else if (txCount > 100) {
    vibes.push({ tag: "Active", count: txCount });
  } else if (txCount > 10) {
    vibes.push({ tag: "Regular", count: txCount });
  } else if (txCount > 0) {
    vibes.push({ tag: "Selective", count: txCount });
  }

  // Contract interaction vibes
  if (contractCalls > 50) {
    vibes.push({ tag: "Soroban Power User", count: contractCalls });
  } else if (contractCalls > 10) {
    vibes.push({ tag: "Soroban Explorer", count: contractCalls });
  } else if (contractCalls > 0) {
    vibes.push({ tag: "Contract Curious", count: contractCalls });
  }

  // Special activity vibes
  if (vibeMap.has("bridge-warrior") && (vibeMap.get("bridge-warrior") || 0) > 5) {
    vibes.push({
      tag: "Bridge Master",
      count: vibeMap.get("bridge-warrior") || 0,
    });
  }

  if (vibeMap.has("defi-trader") && (vibeMap.get("defi-trader") || 0) > 10) {
    vibes.push({
      tag: "DeFi Enthusiast",
      count: vibeMap.get("defi-trader") || 0,
    });
  }

  // Multi-asset user
  if (assetMap.size > 5) {
    vibes.push({ tag: "Asset Diversifier", count: assetMap.size });
  }

  // Return at least one vibe
  if (vibes.length === 0) {
    vibes.push({ tag: "Stellar Explorer", count: txCount });
  }

  return vibes;
}
