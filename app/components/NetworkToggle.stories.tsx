import type { Meta, StoryObj } from "@storybook/nextjs";
import { NetworkToggle } from "./NetworkToggle";
import { useWrapStore } from "../store/wrapStore";
import { NETWORKS } from "../../src/config";
import { withStore } from "../../.storybook/withStore";

const meta = {
  title: "Components/NetworkToggle",
  component: NetworkToggle,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NetworkToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mainnet: Story = {
  decorators: [withStore(useWrapStore, { network: NETWORKS.MAINNET })],
};

export const Testnet: Story = {
  decorators: [withStore(useWrapStore, { network: NETWORKS.TESTNET })],
};
