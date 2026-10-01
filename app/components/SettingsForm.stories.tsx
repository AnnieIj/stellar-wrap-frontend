import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { SettingsForm } from "./SettingsForm";
import type {
  SettingsEmailStatus,
  SettingsFormProps,
  SettingsPeriodChannel,
} from "./SettingsForm";
import type { PeriodPrefs } from "@/app/types/notifications";

type StoryProps = Omit<
  SettingsFormProps,
  "onPushToggle" | "onEmailChange" | "onEmailSubmit" | "onPeriodChange"
>;

const defaultPeriods = { push: { weekly: true, monthly: false, yearly: false } };

/**
 * Renders the form with local state so toggles/periods respond in the preview
 * without needing a running backend or the notification store.
 */
function InteractiveSettingsForm({ email = "", ...args }: StoryProps) {
  const [pushEnabled, setPushEnabled] = useState(args.pushEnabled ?? false);
  const [emailStatus, setEmailStatus] = useState<SettingsEmailStatus>(
    args.emailStatus ?? "inactive",
  );
  const [periods, setPeriods] = useState(args.periods ?? defaultPeriods);
  const [emailInput, setEmailInput] = useState(email);

  function handlePeriodChange(
    channel: SettingsPeriodChannel,
    period: keyof PeriodPrefs,
    value: boolean,
  ) {
    setPeriods((prev) => ({
      ...prev,
      [channel]: { ...prev[channel], [period]: value },
    }));
  }

  return (
    <SettingsForm
      {...args}
      pushEnabled={pushEnabled}
      emailStatus={emailStatus}
      periods={periods}
      email={emailInput}
      onPushToggle={(enabled) => setPushEnabled(enabled)}
      onEmailChange={(value) => setEmailInput(value)}
      onEmailSubmit={(value) => {
        if (!value) return;
        setEmailInput(value);
        setEmailStatus("pending");
      }}
      onPeriodChange={handlePeriodChange}
    />
  );
}

const meta = {
  title: "Components/SettingsForm",
  component: InteractiveSettingsForm,
  parameters: { layout: "centered" },
  args: {
    email: "designer@example.com",
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "secondary"],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[480px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InteractiveSettingsForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: "primary",
    pushEnabled: true,
    emailStatus: "active",
    emailEnabled: true,
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    pushEnabled: true,
    emailStatus: "active",
    emailEnabled: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    pushEnabled: true,
    emailStatus: "pending",
  },
};
