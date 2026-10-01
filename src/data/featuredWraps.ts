export interface FeaturedWrap {
  id: string;
  persona: string;
  transactionCount: number;
  archetypeImage: string;
  shareCardImage: string;
  topVibe: string;
  username: string;
}

export const FEATURED_WRAPS: FeaturedWrap[] = [
  {
    id: "wizard",
    persona: "The Wizard",
    transactionCount: 847,
    archetypeImage: "/featured/wizard-thumb.svg",
    shareCardImage: "/featured/wizard-card.svg",
    topVibe: "DeFi Sorcerer",
    username: "stellar_legend",
  },
  {
    id: "explorer",
    persona: "The Explorer",
    transactionCount: 312,
    archetypeImage: "/featured/explorer-thumb.svg",
    shareCardImage: "/featured/explorer-card.svg",
    topVibe: "Stellar Explorer",
    username: "cosmic_voyager",
  },
  {
    id: "architect",
    persona: "The Architect",
    transactionCount: 1204,
    archetypeImage: "/featured/architect-thumb.svg",
    shareCardImage: "/featured/architect-card.svg",
    topVibe: "Soroban Builder",
    username: "soroban_dev",
  },
  {
    id: "patron",
    persona: "The Patron",
    transactionCount: 589,
    archetypeImage: "/featured/patron-thumb.svg",
    shareCardImage: "/featured/patron-card.svg",
    topVibe: "dApp Champion",
    username: "defi_patron",
  },
  {
    id: "collector",
    persona: "The Collector",
    transactionCount: 423,
    archetypeImage: "/featured/collector-thumb.svg",
    shareCardImage: "/featured/collector-card.svg",
    topVibe: "Art Curator",
    username: "nft_collector",
  },
];
