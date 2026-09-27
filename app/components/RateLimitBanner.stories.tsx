import type { Meta, StoryObj } from "@storybook/nextjs";
import { RateLimitBanner } from "./RateLimitBanner";
import { useRateLimitStore } from "../../src/store/rateLimitStore";
import { withStore } from "../../.storybook/withStore";

const meta = {
  title: "Components/RateLimitBanner",
  component: RateLimitBanner,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RateLimitBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RateLimited: Story = {
  decorators: [
    withStore(useRateLimitStore, {
      isRateLimited: true,
      resetTime: Date.now() + 30_000,
      retryAttempt: 0,
      message: "Too many requests to Horizon. Cooling down.",
    }),
  ],
};

export const Retrying: Story = {
  decorators: [
    withStore(useRateLimitStore, {
      isRateLimited: false,
      resetTime: null,
      retryAttempt: 2,
      message: "Retrying request…",
    }),
  ],
};

export const Hidden: Story = {
  decorators: [
    withStore(useRateLimitStore, {
      isRateLimited: false,
      resetTime: null,
      retryAttempt: 0,
      message: null,
    }),
  ],
};
