import type { Meta, StoryObj } from "@storybook/nextjs";
import { ProgressIndicator } from "./ProgressIndicator";

const meta = {
  title: "Components/ProgressIndicator",
  component: ProgressIndicator,
  parameters: { layout: "centered" },
  args: { totalSteps: 6, showNext: true },
  argTypes: {
    currentStep: { control: { type: "number", min: 1, max: 6 } },
    totalSteps: { control: { type: "number", min: 1 } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Step1: Story = { args: { currentStep: 1 } };
export const Step2: Story = { args: { currentStep: 2 } };
export const Step3: Story = { args: { currentStep: 3 } };
export const Step4: Story = { args: { currentStep: 4 } };
export const Step5: Story = { args: { currentStep: 5 } };
export const Step6: Story = { args: { currentStep: 6, showNext: false } };
