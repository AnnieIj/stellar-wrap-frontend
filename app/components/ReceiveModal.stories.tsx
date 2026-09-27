import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState, type ComponentProps } from "react";
import { ReceiveModal } from "./ReceiveModal";

const SAMPLE_ADDRESS =
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

/**
 * Wrapper that manages `open` state internally so Storybook controls can
 * toggle all other props without needing to pass open/onClose directly.
 *
 * The modal re-opens automatically after being closed so reviewers can keep
 * interacting with controls without having to reload the story.
 */
function ReceiveModalDemo(
  props: Omit<ComponentProps<typeof ReceiveModal>, "open" | "onClose">,
) {
  const [open, setOpen] = useState(true);
  return (
    <ReceiveModal
      {...props}
      open={open}
      onClose={() => {
        setOpen(false);
        // Re-open after a short delay so reviewers can dismiss and reopen
        // without refreshing the page.
        window.setTimeout(() => setOpen(true), 400);
      }}
    />
  );
}

const meta = {
  title: "Components/ReceiveModal",
  component: ReceiveModalDemo,
  parameters: {
    layout: "fullscreen",
    a11y: { test: "error" },
    docs: {
      description: {
        component:
          "A modal dialog for displaying a Stellar receive address and QR code. " +
          "Supports primary and secondary variants, loading/disabled states, " +
          "mainnet/testnet labelling, and inline error display.",
      },
    },
  },
  args: {
    address: SAMPLE_ADDRESS,
    network: "testnet",
    variant: "primary",
    loading: false,
    disabled: false,
    error: null,
  },
  argTypes: {
    variant: {
      description: "Visual density / emphasis variant",
      control: { type: "radio" },
      options: ["primary", "secondary"] satisfies Array<
        ComponentProps<typeof ReceiveModal>["variant"]
      >,
    },
    network: {
      description: "Stellar network the address belongs to",
      control: { type: "radio" },
      options: ["mainnet", "testnet"] satisfies Array<
        ComponentProps<typeof ReceiveModal>["network"]
      >,
    },
    loading: {
      description: "Show loading skeleton (e.g. while resolving the address)",
      control: "boolean",
    },
    disabled: {
      description: "Disable interactive controls (copy button)",
      control: "boolean",
    },
    error: {
      description: "Inline error message shown instead of the QR / address",
      control: "text",
    },
    title: {
      description: "Modal heading text",
      control: "text",
    },
    description: {
      description: "Supporting copy below the heading",
      control: "text",
    },
    address: {
      description: "Stellar public key to receive funds",
      control: "text",
    },
  },
} satisfies Meta<typeof ReceiveModalDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Core variants ────────────────────────────────────────────────────────────

/** Default primary variant — full address shown in the copy field. */
export const Primary: Story = {
  name: "Primary (default)",
};

/**
 * Secondary variant — address is truncated in the copy field and a
 * "Scan to send" hint is shown beneath the QR code.
 */
export const Secondary: Story = {
  name: "Secondary",
  args: { variant: "secondary" },
};

// ─── State variants ───────────────────────────────────────────────────────────

/**
 * Loading state — shown while the address is being resolved (e.g. waiting
 * for Freighter to return a public key).
 */
export const Loading: Story = {
  name: "Loading",
  args: { loading: true },
  parameters: {
    docs: {
      description: {
        story:
          "QR panel shows a spinner and the address field displays a placeholder. " +
          "All interactive controls are suppressed.",
      },
    },
  },
};

/**
 * Disabled state — controls are rendered but non-interactive (e.g. the
 * connected wallet requires a confirmation step before sharing the address).
 */
export const Disabled: Story = {
  name: "Disabled",
  args: { disabled: true },
};

/**
 * Error state — the QR panel is replaced by an inline error banner.
 * All copy/QR controls are hidden.
 */
export const WithError: Story = {
  name: "Error",
  args: { error: "Unable to load your receive address. Please try again." },
  parameters: {
    docs: {
      description: {
        story:
          "Rendered when address resolution fails. The `error` prop replaces " +
          "the QR panel with a `role=\"alert\"` banner.",
      },
    },
  },
};

/**
 * Error with a longer message — verifies the banner wraps correctly at
 * narrow widths.
 */
export const WithLongError: Story = {
  name: "Error (long message)",
  args: {
    error:
      "Your Freighter wallet is connected to Mainnet, but this app is set to Testnet. " +
      "Please switch your Freighter network to Testnet and try again.",
  },
};

// ─── Network variants ─────────────────────────────────────────────────────────

/** Mainnet address — label reads "Mainnet address". */
export const Mainnet: Story = {
  name: "Mainnet",
  args: { network: "mainnet" },
};

/** Testnet address — label reads "Testnet address" (default). */
export const Testnet: Story = {
  name: "Testnet",
  args: { network: "testnet" },
};

// ─── Copy combinations ────────────────────────────────────────────────────────

/** Custom title and description override the defaults. */
export const CustomCopy: Story = {
  name: "Custom title & description",
  args: {
    title: "Send funds here",
    description:
      "Use this Testnet address to receive XLM from the Stellar testnet faucet.",
  },
};

// ─── Composed variants ────────────────────────────────────────────────────────

/** Secondary + Mainnet — compact view on a live network. */
export const SecondaryMainnet: Story = {
  name: "Secondary + Mainnet",
  args: {
    variant: "secondary",
    network: "mainnet",
  },
};

/** Secondary + Loading — skeleton in compact layout. */
export const SecondaryLoading: Story = {
  name: "Secondary + Loading",
  args: {
    variant: "secondary",
    loading: true,
  },
};

/** Secondary + Error — error banner in compact layout. */
export const SecondaryError: Story = {
  name: "Secondary + Error",
  args: {
    variant: "secondary",
    error: "Address could not be retrieved. Please reconnect your wallet.",
  },
};

// ─── Accessibility ────────────────────────────────────────────────────────────

/**
 * Keyboard & ARIA smoke-test story.
 *
 * All stories run the Storybook a11y addon automatically (see preview.tsx:
 * `a11y: { test: "error" }`).  This story is intentionally identical to
 * `Primary` so reviewers can confirm the modal traps focus correctly and
 * ARIA attributes are in order.
 */
export const AccessibilityCheck: Story = {
  name: "Accessibility (ARIA / focus)",
  parameters: {
    docs: {
      description: {
        story:
          "Verifies `role=\"dialog\"`, `aria-modal`, `aria-labelledby`, and " +
          "`aria-describedby` are wired up correctly. Escape key should close " +
          "the modal (it re-opens after 400 ms in this wrapper).",
      },
    },
  },
};
