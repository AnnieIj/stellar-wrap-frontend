import type { IndexingStep } from "@/app/types/indexing";

export type FactCategory = "general" | "throughput" | "assets" | "contracts";

export interface StellarFact {
  text: string;
  category: FactCategory;
  /** Indexing steps where this fact is especially relevant */
  relevantSteps?: IndexingStep[];
}

export const STELLAR_FACTS: StellarFact[] = [
  {
    text: "Stellar processes 1,000+ transactions per second with sub-second finality.",
    category: "throughput",
    relevantSteps: ["fetching-transactions"],
  },
  {
    text: "The Stellar network confirms most payments in 3–5 seconds.",
    category: "throughput",
    relevantSteps: ["fetching-transactions"],
  },
  {
    text: "Stellar was founded in 2014 to make money more fluid and accessible worldwide.",
    category: "general",
  },
  {
    text: "Over 7 million accounts have been created on the Stellar network.",
    category: "general",
  },
  {
    text: "USDC on Stellar is one of the largest stablecoin corridors for cross-border payments.",
    category: "assets",
    relevantSteps: ["identifying-assets"],
  },
  {
    text: "Stellar supports thousands of assets — from XLM to custom tokens issued by any account.",
    category: "assets",
    relevantSteps: ["identifying-assets"],
  },
  {
    text: "Circle's USDC natively lives on Stellar, enabling fast, low-cost dollar transfers.",
    category: "assets",
    relevantSteps: ["identifying-assets"],
  },
  {
    text: "Stellar anchors connect the network to traditional banks and payment rails globally.",
    category: "general",
  },
  {
    text: "Soroban is Stellar's smart contract platform, bringing Rust-based contracts to the network.",
    category: "contracts",
    relevantSteps: ["counting-contracts"],
  },
  {
    text: "Soroban contracts use a fee model designed to stay predictable even under load.",
    category: "contracts",
    relevantSteps: ["counting-contracts"],
  },
  {
    text: "Stellar's consensus protocol (SCP) uses federated voting — no mining required.",
    category: "general",
  },
  {
    text: "The Stellar Development Foundation supports open-source tools for builders worldwide.",
    category: "general",
  },
  {
    text: "Stellar's path payments let you send one asset and have the recipient receive another.",
    category: "assets",
    relevantSteps: ["identifying-assets"],
  },
  {
    text: "Over 100 organizations run validators on the Stellar network.",
    category: "general",
  },
  {
    text: "Stellar's base fee is just 0.00001 XLM per operation — fractions of a cent.",
    category: "throughput",
    relevantSteps: ["fetching-transactions"],
  },
  {
    text: "Soroban smart contracts can interact with Stellar's built-in DEX and payment ops natively.",
    category: "contracts",
    relevantSteps: ["counting-contracts"],
  },
  {
    text: "MoneyGram and other remittance giants use Stellar for real-time settlement.",
    category: "general",
  },
  {
    text: "Stellar accounts can hold multiple asset types simultaneously in a single wallet.",
    category: "assets",
    relevantSteps: ["identifying-assets"],
  },
];

/** Fisher–Yates shuffle (returns new array) */
export function shuffleFacts(facts: StellarFact[]): StellarFact[] {
  const shuffled = [...facts];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Prefer facts relevant to the current indexing step, then fill with general facts */
export function getFactsForStep(
  step: IndexingStep | null,
  shuffled: StellarFact[],
): StellarFact[] {
  if (!step) return shuffled;

  const relevant = shuffled.filter(
    (f) => f.relevantSteps?.includes(step) ?? false,
  );
  const rest = shuffled.filter(
    (f) => !(f.relevantSteps?.includes(step) ?? false),
  );
  return [...relevant, ...rest];
}
