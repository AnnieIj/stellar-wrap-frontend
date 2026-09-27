import type { Meta, StoryObj } from "@storybook/react";
import { ErrorCard } from "./ErrorCard";

const meta = { title: "Components/ErrorCard", component: ErrorCard, parameters: { layout: "fullscreen" } } satisfies Meta<typeof ErrorCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Recoverable: Story = { args: { error: new Error("The data service is temporarily unavailable."), reset: () => undefined } };
export const CustomTitle: Story = { args: { error: new Error("Try again after checking your connection."), title: "Unable to load your wrap", reset: () => undefined } };
