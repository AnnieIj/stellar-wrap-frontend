import type { Meta, StoryObj } from "@storybook/nextjs";
import { PwaInstallPrompt } from "./PwaInstallPrompt";

const meta = { title: "Components/PwaInstallPrompt", component: PwaInstallPrompt, parameters: { layout: "fullscreen" } } satisfies Meta<typeof PwaInstallPrompt>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Installable: Story = { parameters: { docs: { description: { story: "The prompt appears after a returning mobile visit when the browser supplies beforeinstallprompt." } } } };
export const Dismissed: Story = { parameters: { docs: { description: { story: "Dismissal persists locally and prevents the prompt from reappearing." } } } };
