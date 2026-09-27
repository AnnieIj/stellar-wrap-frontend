import type { Meta, StoryObj } from "@storybook/nextjs";
import { TransactionSignDialog } from "./TransactionSignDialog";

const meta = {
  title: "Components/TransactionSignDialog",
  component: TransactionSignDialog,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TransactionSignDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Signing: Story = {
  args: {
    open: true,
    status: "signing",
    providerName: "Freighter",
    description: "Check your Freighter wallet and approve the signature request.",
  },
};

export const Failed: Story = {
  args: {
    open: true,
    status: "failed",
    providerName: "Freighter",
    failureMessage:
      "Freighter is connected to a different network than the one this app is using. Switch Freighter and try again.",
  },
};

export const FailedWithActions: Story = {
  args: {
    open: true,
    status: "failed",
    providerName: "Albedo",
    failureMessage: "The transaction signature was rejected in your wallet.",
    onRetry: () => {},
    onDismiss: () => {},
  },
};