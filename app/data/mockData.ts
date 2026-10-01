// Mock user data
export const mockData = {
  username: "stellar_legend",
  transactions: 420,
  percentile: 80,
  dapps: [
    {
      name: "Mercurius",
      color: "#FF6B9D",
      gradient: "linear-gradient(135deg, #FF6B9D 0%, #C44569 100%)",
      transactions: 187,
    },
    {
      name: "Phoenix",
      color: "#4ACFFE",
      gradient: "linear-gradient(135deg, #4ACFFE 0%, #00F2FE 100%)",
      transactions: 142,
    },
    {
      name: "Blend",
      color: "#43E97B",
      gradient: "linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)",
      transactions: 91,
    },
  ],
  vibes: [
    {
      type: "defi",
      percentage: 60,
      color: "linear-gradient(135deg, #A445B2 0%, #D41872 100%)",
      label: "DeFi Sorcerer",
    },
    {
      type: "nft",
      percentage: 30,
      color: "linear-gradient(135deg, #FA709A 0%, #FEE140 100%)",
      label: "Art Curator",
    },
    {
      type: "dev",
      percentage: 10,
      color: "linear-gradient(135deg, #30CF9CD0 0%, #330867 100%)",
      label: "Code Alchemist",
    },
  ],
  persona: "The Wizard",
  personaDescription:
    "Like Gandalf in Middle-earth, you wield DeFi magic with wisdom. The blockchain bends to your will.",
};

// Mock asset card data for Storybook
export interface AssetCardMockData {
  id: string;
  name: string;
  symbol: string;
  balance: number;
  usdValue: number;
  changePercent: number;
  variant: "primary" | "secondary";
  isLoading: boolean;
  isDisabled: boolean;
}

export const mockAssetCards: AssetCardMockData[] = [
  {
    id: "eth-primary",
    name: "Ethereum",
    symbol: "ETH",
    balance: 12.5,
    usdValue: 24123.45,
    changePercent: 5.23,
    variant: "primary",
    isLoading: false,
    isDisabled: false,
  },
  {
    id: "btc-secondary",
    name: "Bitcoin",
    symbol: "BTC",
    balance: 0.75,
    usdValue: 28456.78,
    changePercent: -2.12,
    variant: "secondary",
    isLoading: false,
    isDisabled: false,
  },
  {
    id: "ada-disabled",
    name: "Cardano",
    symbol: "ADA",
    balance: 1200,
    usdValue: 987.12,
    changePercent: 0.87,
    variant: "primary",
    isLoading: false,
    isDisabled: true,
  },
  {
    id: "sol-loading",
    name: "Solana",
    symbol: "SOL",
    balance: 45.2,
    usdValue: 5678.9,
    changePercent: 12.03,
    variant: "secondary",
    isLoading: true,
    isDisabled: false,
  },
];
