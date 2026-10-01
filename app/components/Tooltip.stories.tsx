import type { Meta, StoryObj } from "@storybook/nextjs";
import { Tooltip, type TooltipProps } from "./Tooltip";

const trigger = (
  <button
    type="button"
    className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
  >
    Hover me
  </button>
);

function TooltipDemo(args: TooltipProps) {
  return <Tooltip {...args}>{trigger}</Tooltip>;
}

const meta = {
  title: "Components/Tooltip",
  component: TooltipDemo,
  parameters: { layout: "centered" },
  args: {
    content: "This is a tooltip",
  },
  argTypes: {
    placement: {
      control: { type: "select" },
      options: ["top", "bottom", "left", "right"],
    },
    variant: {
      control: { type: "select" },
      options: ["primary", "secondary", "disabled"],
    },
  },
} satisfies Meta<typeof TooltipDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    content: "Primary tooltip text",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    content: "Secondary tooltip text",
  },
};

export const Disabled: Story = {
  args: {
    variant: "disabled",
    disabled: true,
    content: "Disabled tooltip",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    content: "Loading tooltip text",
  },
};

export const PlacementTop: Story = {
  args: {
    placement: "top",
    content: "Tooltip placed on top",
  },
};

export const PlacementBottom: Story = {
  args: {
    placement: "bottom",
    content: "Tooltip placed on bottom",
  },
};

export const PlacementLeft: Story = {
  args: {
    placement: "left",
    content: "Tooltip placed on left",
  },
};

export const PlacementRight: Story = {
  args: {
    placement: "right",
    content: "Tooltip placed on right",
  },
};
