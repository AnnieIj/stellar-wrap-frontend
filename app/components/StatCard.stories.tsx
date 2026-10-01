import type { Meta, StoryObj } from "@storybook/nextjs";
import { StatCard } from "./StatCard";

const meta = {
  title: "Components/StatCard",
  component: StatCard,
  parameters: { layout: "centered" },
  argTypes: {
    variant: {
      control: { type: "inline-radio" },
      options: ["primary", "secondary"],
      description: "The visual variant of the card",
    },
    disabled: {
      control: "boolean",
      description: "Disables the card interaction",
    },
    loading: {
      control: "boolean",
      description: "Shows a loading state",
    },
  },
  args: {
    label: "Transactions",
    value: "1,284",
    variant: "primary",
    disabled: false,
    loading: false,
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: "Total Transactions",
    value: "1,284",
    description: "Across all timeframes",
  },
};

export const Secondary: Story = {
  args: {
    label: "Total Volume",
    value: "42.5K XLM",
    description: "7-day average",
    variant: "secondary",
  },
};

export const Disabled: Story = {
  args: {
    label: "Transactions",
    value: "—",
    disabled: true,
    description: "Data unavailable",
  },
};

export const Loading: Story = {
  args: {
    label: "Transactions",
    value: "1,284",
    loading: true,
    description: "Fetching latest data",
  },
};

export const WithIcon: Story = {
  args: {
    label: "Top Asset",
    value: "XLM",
    icon: <span>⭐</span>,
    description: "Most active asset this period",
  },
};

export const Responsive: Story = {
  parameters: {
    layout: "fullscreen",
  },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <div className="w-full max-w-xs">
        <StatCard {...args} />
      </div>
      <div className="w-full max-w-sm">
        <StatCard {...args} />
      </div>
      <div className="w-full max-w-md">
        <StatCard {...args} />
      </div>
      <div className="w-full max-w-lg">
        <StatCard {...args} />
      </div>
    </div>
  ),
};
