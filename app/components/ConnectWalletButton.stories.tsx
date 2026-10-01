import type { Meta, StoryObj } from "@storybook/nextjs";
import { ConnectWalletButton } from "./ConnectWalletButton";

const meta = {
  title: "Components/ConnectWalletButton",
  component: ConnectWalletButton,
  parameters: { layout: "centered" },
  argTypes: {
    walletName: { control: "text" },
    connectingLabel: { control: "text" },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConnectWalletButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    walletName: "Freighter",
    icon: <span>👛</span>,
    onConnect: () => {},
  },
};

export const Secondary: Story = {
  args: {
    walletName: "Albedo",
    icon: <span>🔐</span>,
    onConnect: () => {},
  },
};

export const Disabled: Story = {
  args: {
    walletName: "Freighter",
    icon: <span>👛</span>,
    onConnect: () => {},
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    walletName: "Freighter",
    icon: <span>👛</span>,
    onConnect: () => {},
    isConnecting: true,
  },
};

export const Responsive: Story = {
  parameters: {
    layout: "fullscreen",
  },
  render: () => (
    <div className="flex flex-col gap-4 items-center">
      <div className="w-full max-w-xs">
        <ConnectWalletButton walletName="Freighter" icon={<span>👛</span>} onConnect={() => {}} />
      </div>
      <div className="w-full max-w-sm">
        <ConnectWalletButton walletName="Freighter" icon={<span>👛</span>} onConnect={() => {}} />
      </div>
      <div className="w-full max-w-md">
        <ConnectWalletButton walletName="Freighter" icon={<span>👛</span>} onConnect={() => {}} disabled />
      </div>
      <div className="w-full max-w-lg">
        <ConnectWalletButton walletName="Freighter" icon={<span>👛</span>} onConnect={() => {}} isConnecting />
      </div>
    </div>
  ),
};
