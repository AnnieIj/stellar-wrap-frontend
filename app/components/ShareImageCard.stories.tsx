import type { Meta, StoryObj } from "@storybook/nextjs";
import { ShareImageCard } from "./ShareImageCard";

const meta = {
  title: "Share/ShareImageCard",
  component: ShareImageCard,
  parameters: { layout: "centered" },
  argTypes: {
    themeColor: { control: { type: "color" } },
    archetypeImage: { control: { type: "text" } },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShareImageCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Wizard: Story = {
  args: { themeColor: "#1DB954", archetypeImage: "/archetypes/wizard.png" },
};

export const Explorer: Story = {
  args: { themeColor: "#3b82f6", archetypeImage: "/archetypes/explorer.png" },
};

export const PurpleTheme: Story = {
  args: { themeColor: "#a855f7", archetypeImage: "/archetypes/wizard.png" },
};

export const DerivedFromPersona: Story = {
  args: { themeColor: "#1DB954" },
};
