import type { Meta, StoryObj } from "@storybook/nextjs";
import { OfflineBanner } from "./OfflineBanner";

const meta = { title: "Components/OfflineBanner", component: OfflineBanner, parameters: { layout: "fullscreen" } } satisfies Meta<typeof OfflineBanner>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Offline: Story = { parameters: { docs: { description: { story: "Shown when the browser loses connectivity; cached data remains available." } } } };
