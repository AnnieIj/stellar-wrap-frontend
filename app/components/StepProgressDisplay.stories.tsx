import type { Meta, StoryObj } from "@storybook/nextjs";
import { StepProgressDisplay } from "./StepProgressDisplay";
import { useWrapStore } from "../store/wrapStore";
import { STEP_ORDER, type IndexingStep } from "../types/indexing";
import { withStore } from "../../.storybook/withStore";

const meta = {
  title: "Indexing/StepProgressDisplay",
  component: StepProgressDisplay,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof StepProgressDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Builds an in-progress indexing state stopped on the given step index. */
function atStep(index: number) {
  const stepProgress = Object.fromEntries(
    STEP_ORDER.map((step, i) => [step, i < index ? 100 : i === index ? 55 : 0]),
  ) as Record<IndexingStep, number>;

  return {
    isLoading: true,
    indexingError: null,
    currentStep: STEP_ORDER[index],
    stepProgress,
    completedSteps: index,
    totalSteps: STEP_ORDER.length,
    overallProgress: Math.round(((index + 0.55) / STEP_ORDER.length) * 100),
    estimatedTimeRemaining: (STEP_ORDER.length - index) * 1500,
  };
}

export const Initializing: Story = {
  decorators: [withStore(useWrapStore, atStep(0))],
};

export const FetchingTransactions: Story = {
  decorators: [withStore(useWrapStore, atStep(1))],
};

export const FilteringTimeframes: Story = {
  decorators: [withStore(useWrapStore, atStep(2))],
};

export const CalculatingVolume: Story = {
  decorators: [withStore(useWrapStore, atStep(3))],
};

export const IdentifyingAssets: Story = {
  decorators: [withStore(useWrapStore, atStep(4))],
};

export const CountingContracts: Story = {
  decorators: [withStore(useWrapStore, atStep(5))],
};

export const Finalizing: Story = {
  decorators: [withStore(useWrapStore, atStep(6))],
};

export const ErrorState: Story = {
  decorators: [
    withStore(useWrapStore, {
      isLoading: false,
      currentStep: "fetching-transactions",
      indexingError: {
        step: "fetching-transactions",
        message: "Horizon request failed after 3 retries",
        recoverable: true,
      },
    }),
  ],
};
