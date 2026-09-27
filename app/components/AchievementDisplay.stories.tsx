import type { Meta, StoryObj } from "@storybook/nextjs";
import { AchievementDisplay } from "./AchievementDisplay";
import type { IndexerResult, DappInfo, VibeTag } from "../utils/indexer";

const dapps = (n: number): DappInfo[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `dApp ${i + 1}`,
    volume: (n - i) * 1200,
    transactionCount: (n - i) * 8,
  }));

const vibes = (n: number): VibeTag[] =>
  Array.from({ length: n }, (_, i) => ({ tag: `vibe-${i + 1}`, count: n - i }));

const result = (over: Partial<IndexerResult>): IndexerResult => ({
  accountId: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
  totalTransactions: 0,
  totalVolume: 0,
  mostActiveAsset: "",
  contractCalls: 0,
  gasSpent: 0,
  dapps: [],
  vibes: [],
  ...over,
});

const meta = {
  title: "Components/AchievementDisplay",
  component: AchievementDisplay,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 560 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AchievementDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: { result: null, loading: true },
};

export const NoAchievements: Story = {
  args: { result: result({}) },
};

export const ThreeAchievements: Story = {
  args: {
    result: result({
      totalTransactions: 142,
      totalVolume: 9_800,
      mostActiveAsset: "XLM",
      contractCalls: 12,
      dapps: dapps(3),
      vibes: vibes(3),
    }),
  },
};

export const TenAchievements: Story = {
  args: {
    result: result({
      totalTransactions: 2_104,
      totalVolume: 187_500,
      mostActiveAsset: "USDC",
      contractCalls: 318,
      gasSpent: 42,
      dapps: dapps(10),
      vibes: vibes(10),
    }),
  },
};
