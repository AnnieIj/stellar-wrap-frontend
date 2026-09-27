import type { Meta, StoryObj } from "@storybook/nextjs";
import { DappCard } from "./DappCard";

const meta = {
  title: "Components/DappCard",
  component: DappCard,
  parameters: { layout: "centered" },
  argTypes: {
    rank: { control: { type: "number", min: 1 } },
    interactions: { control: { type: "number", min: 0 } },
    delay: { control: { type: "number", step: 0.1 } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DappCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dex: Story = {
  args: { rank: 1, name: "StellarX", interactions: 1284 },
};

export const Wallet: Story = {
  args: { rank: 2, name: "Freighter", interactions: 642 },
};

export const Bridge: Story = {
  args: { rank: 3, name: "Allbridge", interactions: 318 },
};

export const UnknownContract: Story = {
  args: {
    rank: 1,
    name: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQONFCIUQG74P3UDMQ74P6C6DJCCEF",
    interactions: 12,
  },
};
