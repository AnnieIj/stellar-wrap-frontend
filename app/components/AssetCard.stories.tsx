import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import AssetCard from "./AssetCard";
import type { AssetMetadata } from "../types/asset";

const meta: Meta<typeof AssetCard> = {
  title: "Components/AssetCard",
  component: AssetCard,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: { type: "inline-radio" },
      options: ["primary", "secondary"],
      description: "The visual variant of the card",
    },
    selected: {
      control: "boolean",
      description: "Whether the card is selected",
    },
    disabled: {
      control: "boolean",
      description: "Disables the card interaction",
    },
    loading: {
      control: "boolean",
      description: "Shows a loading skeleton",
    },
    onClick: { action: "clicked" },
  },
  args: {
    asset: {
      code: "USDC",
      issuer: "GAB...",
      name: "USD Coin",
      domain: "centre.io",
      isNative: false,
    },
    variant: "primary",
    selected: false,
    disabled: false,
    loading: false,
  },
};

export default meta;
type Story = StoryObj<typeof AssetCard>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: "secondary",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const Selected: Story = {
  args: {
    selected: true,
  },
};

export const WithoutLogo: Story = {
  args: {
    asset: {
      code: "XLM",
      name: "Stellar",
      domain: "stellar.org",
      isNative: true,
    },
  },
};

export const LongIssuer: Story = {
  args: {
    asset: {
      code: "SRT",
      issuer: "GAAAABBBBCCCCCDDDEEEEFFFGGGGHHIIIIJ",
      name: "Super Long Token Name That Should Truncate Gracefully",
      domain: "example.com",
      isNative: false,
    },
  },
};

export const Interactive: Story = {
  args: {
    asset: {
      code: "BTC",
      name: "Bitcoin",
      domain: "bitcoin.org",
      isNative: false,
    },
  },
  render: (args) => (
    <div className="w-full max-w-sm space-y-4">
      <AssetCard {...args} />
      <AssetCard {...args} asset={{ ...args.asset, code: "ETH", name: "Ethereum" }} />
      <AssetCard {...args} asset={{ ...args.asset, code: "XLM", name: "Stellar" }} />
    </div>
  ),
};

export const Responsive: Story = {
  parameters: {
    layout: "fullscreen",
  },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <div className="w-full max-w-xs">
        <AssetCard {...args} />
      </div>
      <div className="w-full max-w-sm">
        <AssetCard {...args} />
      </div>
      <div className="w-full max-w-md">
        <AssetCard {...args} />
      </div>
      <div className="w-full max-w-lg">
        <AssetCard {...args} />
      </div>
    </div>
  ),
};
