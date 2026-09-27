import type { Meta, StoryObj } from "@storybook/nextjs";
import { IndexingProgress } from "./IndexingProgress";
import { withStore } from "../../.storybook/withStore";
import { useWrapStore } from "../store/wrapStore";

const meta = {
  title: "Components/IndexingProgress",
  component: IndexingProgress,
  parameters: { layout: "centered" },
} satisfies Meta<typeof IndexingProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Scanning: Story = { decorators: [withStore(useWrapStore, { isLoading: true, currentStep: "fetching-transactions", overallProgress: 35 })] };
export const Preparing: Story = { decorators: [withStore(useWrapStore, { isLoading: true, currentStep: "initializing", overallProgress: 5 })] };
export const Failed: Story = { decorators: [withStore(useWrapStore, { isLoading: false, indexingError: { step: "fetching-transactions", message: "Horizon is unavailable", recoverable: true } })] };
