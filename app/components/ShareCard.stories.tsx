import type { Meta, StoryObj } from "@storybook/nextjs";
import { useRef, type ComponentProps, type RefObject } from "react";
import { ShareCard } from "./ShareCard";
import { useWrapStore } from "../store/wrapStore";
import { useTransactionStore } from "../store/transactionStore";
import { NETWORKS } from "../../src/config";
import { withStore } from "../../.storybook/withStore";

type ShareCardStoryProps = Omit<ComponentProps<typeof ShareCard>, "shareImageRef">;

/** Supplies the live `shareImageRef` the component needs for image export. */
function ShareCardWithRef(args: ShareCardStoryProps) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div style={{ width: 480 }}>
      <ShareCard {...args} shareImageRef={ref as RefObject<HTMLDivElement>} />
      <div ref={ref} style={{ position: "absolute", left: -9999, top: -9999 }} />
    </div>
  );
}

const meta = {
  title: "Share/ShareCard",
  component: ShareCardWithRef,
  parameters: { layout: "centered" },
  args: {
    username: "stellar.eth",
    transactions: 1842,
    persona: "The Wizard",
    topVibe: "DeFi Degen",
    vibePercentage: 64,
  },
  decorators: [
    withStore(useWrapStore, {
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
      network: NETWORKS.MAINNET,
    }),
  ],
} satisfies Meta<typeof ShareCardWithRef>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [withStore(useTransactionStore, { transactionState: "idle" })],
};

export const Minting: Story = {
  decorators: [withStore(useTransactionStore, { transactionState: "submitting" })],
};

export const Confirmed: Story = {
  decorators: [
    withStore(useTransactionStore, {
      transactionState: "confirmed",
      transactionHash:
        "a1b2c3d4e5f6071829ab0c1d2e3f4051627384950a1b2c3d4e5f60718293a4b5",
    }),
  ],
};
