import type { Meta, StoryObj } from "@storybook/nextjs";
import { MuteToggle } from "./MuteToggle";
import { withStore } from "../../.storybook/withStore";
import { useSoundStore } from "../store/soundStore";

const meta = { title: "Components/MuteToggle", component: MuteToggle, parameters: { layout: "centered" } } satisfies Meta<typeof MuteToggle>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unmuted: Story = { decorators: [withStore(useSoundStore, { isMuted: false })] };
export const Muted: Story = { decorators: [withStore(useSoundStore, { isMuted: true })] };
