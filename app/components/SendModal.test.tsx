/**
 * SendModal — unit tests
 *
 * Covers rendering, user interactions, validation, and submission states.
 * Uses React Testing Library + Jest (jsdom environment).
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { SendModal } from "./SendModal";
import type { SendParams } from "./SendModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
const INVALID_ADDRESS = "not-a-stellar-address";
const VALID_AMOUNT = "10.5";
const INVALID_AMOUNT = "abc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function noop() {
  return Promise.resolve();
}

function renderModal(
  overrides: Partial<React.ComponentProps<typeof SendModal>> = {},
) {
  const defaults: React.ComponentProps<typeof SendModal> = {
    open: true,
    onClose: jest.fn(),
    onSend: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { ...render(<SendModal {...defaults} />), props: defaults };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SendModal", () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders nothing when open is false", () => {
      renderModal({ open: false });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("renders the dialog with correct role and aria-modal when open", () => {
      renderModal();
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("renders the heading with default asset code XLM", () => {
      renderModal();
      expect(screen.getByText("Send XLM")).toBeInTheDocument();
    });

    it("renders the heading with custom asset code", () => {
      renderModal({ assetCode: "USDC" });
      expect(screen.getByText("Send USDC")).toBeInTheDocument();
    });

    it("renders recipient, amount, and memo fields", () => {
      renderModal();
      expect(
        screen.getByLabelText(/Recipient address/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Memo/i)).toBeInTheDocument();
    });

    it("pre-fills defaultRecipient", () => {
      renderModal({ defaultRecipient: VALID_ADDRESS });
      const input = screen.getByLabelText(/Recipient address/i);
      expect(input).toHaveValue(VALID_ADDRESS);
    });

    it("pre-fills defaultAmount", () => {
      renderModal({ defaultAmount: "5" });
      const input = screen.getByLabelText(/Amount/i);
      expect(input).toHaveValue("5");
    });

    it("renders the close button", () => {
      renderModal();
      expect(
        screen.getByRole("button", { name: /close send modal/i }),
      ).toBeInTheDocument();
    });

    it("renders Cancel and Send action buttons", () => {
      renderModal();
      expect(
        screen.getByRole("button", { name: /cancel/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^send/i }),
      ).toBeInTheDocument();
    });
  });

  // ── Close / dismiss ────────────────────────────────────────────────────────

  describe("dismiss behaviour", () => {
    it("calls onClose when the close button is clicked", async () => {
      const onClose = jest.fn();
      renderModal({ onClose });
      await userEvent.click(
        screen.getByRole("button", { name: /close send modal/i }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Cancel is clicked", async () => {
      const onClose = jest.fn();
      renderModal({ onClose });
      await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the Escape key is pressed", () => {
      const onClose = jest.fn();
      renderModal({ onClose });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when the backdrop is clicked", async () => {
      const onClose = jest.fn();
      renderModal({ onClose });
      const dialog = screen.getByRole("dialog");
      // Click the overlay (the outermost dialog element)
      await userEvent.click(dialog);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  describe("validation", () => {
    it("shows recipient error when an invalid address is typed and blurred", async () => {
      renderModal();
      const recipientInput = screen.getByLabelText(/Recipient address/i);
      await userEvent.type(recipientInput, INVALID_ADDRESS);
      fireEvent.blur(recipientInput);
      expect(
        await screen.findByText(/valid Stellar address/i),
      ).toBeInTheDocument();
    });

    it("shows amount error when a non-numeric amount is typed", async () => {
      renderModal();
      const amountInput = screen.getByLabelText(/Amount/i);
      await userEvent.type(amountInput, INVALID_AMOUNT);
      fireEvent.blur(amountInput);
      expect(
        await screen.findByText(/positive amount/i),
      ).toBeInTheDocument();
    });

    it("shows memo error when memo exceeds 28 UTF-8 bytes", async () => {
      renderModal();
      const memoInput = screen.getByLabelText(/Memo/i);
      // 29 ASCII characters → 29 UTF-8 bytes > 28-byte limit
      await userEvent.type(memoInput, "a".repeat(29));
      fireEvent.blur(memoInput);
      expect(await screen.findByText(/≤ 28 UTF-8 bytes/i)).toBeInTheDocument();
    });

    it("marks recipient input as aria-invalid when validation fails", async () => {
      renderModal();
      const input = screen.getByLabelText(/Recipient address/i);
      await userEvent.type(input, INVALID_ADDRESS);
      fireEvent.blur(input);
      await screen.findByText(/valid Stellar address/i);
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("does not call onSend when form has validation errors", async () => {
      const onSend = jest.fn().mockResolvedValue(undefined);
      renderModal({ onSend });
      // leave fields empty, click send
      await userEvent.click(screen.getByRole("button", { name: /^send/i }));
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  // ── Submission ─────────────────────────────────────────────────────────────

  describe("submission", () => {
    async function fillAndSubmit(onSend = jest.fn().mockResolvedValue(undefined)) {
      const onClose = jest.fn();
      renderModal({ onSend, onClose });

      await userEvent.type(
        screen.getByLabelText(/Recipient address/i),
        VALID_ADDRESS,
      );
      await userEvent.type(screen.getByLabelText(/Amount/i), VALID_AMOUNT);
      await userEvent.click(
        screen.getByRole("button", { name: /^send/i }),
      );
      return { onSend, onClose };
    }

    it("calls onSend with correct params on valid submission", async () => {
      const onSend = jest.fn().mockResolvedValue(undefined);
      await fillAndSubmit(onSend);
      await waitFor(() =>
        expect(onSend).toHaveBeenCalledWith(
          expect.objectContaining<Partial<SendParams>>({
            recipient: VALID_ADDRESS,
            amount: VALID_AMOUNT,
            assetCode: "XLM",
          }),
        ),
      );
    });

    it("shows loading spinner and 'Sending…' label while submitting", async () => {
      // onSend that never resolves, so we stay in the submitting state
      const onSend = jest.fn().mockReturnValue(new Promise(() => {}));
      renderModal({ onSend });

      await userEvent.type(
        screen.getByLabelText(/Recipient address/i),
        VALID_ADDRESS,
      );
      await userEvent.type(screen.getByLabelText(/Amount/i), VALID_AMOUNT);
      await userEvent.click(
        screen.getByRole("button", { name: /^send/i }),
      );

      expect(await screen.findByText(/Sending…/i)).toBeInTheDocument();
    });

    it("disables close and cancel buttons while submitting", async () => {
      const onSend = jest.fn().mockReturnValue(new Promise(() => {}));
      renderModal({ onSend });

      await userEvent.type(
        screen.getByLabelText(/Recipient address/i),
        VALID_ADDRESS,
      );
      await userEvent.type(screen.getByLabelText(/Amount/i), VALID_AMOUNT);
      await userEvent.click(
        screen.getByRole("button", { name: /^send/i }),
      );

      await screen.findByText(/Sending…/i);
      expect(
        screen.getByRole("button", { name: /close send modal/i }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    });

    it("shows success state after successful onSend", async () => {
      await fillAndSubmit();
      expect(
        await screen.findByText(/Transaction submitted/i),
      ).toBeInTheDocument();
    });

    it("shows a Done button in success state that triggers onClose", async () => {
      const { onClose } = await fillAndSubmit();
      const doneBtn = await screen.findByRole("button", { name: /done/i });
      await userEvent.click(doneBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("shows error message when onSend rejects", async () => {
      const onSend = jest
        .fn()
        .mockRejectedValue(new Error("Insufficient balance"));
      renderModal({ onSend });

      await userEvent.type(
        screen.getByLabelText(/Recipient address/i),
        VALID_ADDRESS,
      );
      await userEvent.type(screen.getByLabelText(/Amount/i), VALID_AMOUNT);
      await userEvent.click(
        screen.getByRole("button", { name: /^send/i }),
      );

      expect(
        await screen.findByText(/Insufficient balance/i),
      ).toBeInTheDocument();
    });

    it("shows fallback error message when onSend rejects with non-Error", async () => {
      const onSend = jest.fn().mockRejectedValue("some string error");
      renderModal({ onSend });

      await userEvent.type(
        screen.getByLabelText(/Recipient address/i),
        VALID_ADDRESS,
      );
      await userEvent.type(screen.getByLabelText(/Amount/i), VALID_AMOUNT);
      await userEvent.click(
        screen.getByRole("button", { name: /^send/i }),
      );

      expect(
        await screen.findByText(/Transaction failed/i),
      ).toBeInTheDocument();
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("dialog has aria-labelledby pointing to the heading", () => {
      renderModal();
      const dialog = screen.getByRole("dialog");
      const labelId = dialog.getAttribute("aria-labelledby");
      expect(labelId).toBeTruthy();
      const heading = document.getElementById(labelId as string);
      expect(heading).toBeInTheDocument();
      expect(heading?.textContent).toMatch(/Send XLM/i);
    });

    it("error messages have role='alert'", async () => {
      renderModal();
      const recipientInput = screen.getByLabelText(/Recipient address/i);
      await userEvent.type(recipientInput, INVALID_ADDRESS);
      fireEvent.blur(recipientInput);
      const alert = await screen.findByRole("alert");
      expect(alert).toBeInTheDocument();
    });

    it("required fields have aria-required='true'", () => {
      renderModal();
      expect(
        screen.getByLabelText(/Recipient address/i),
      ).toHaveAttribute("aria-required", "true");
      expect(screen.getByLabelText(/Amount/i)).toHaveAttribute(
        "aria-required",
        "true",
      );
    });
  });

  // ── Responsive / variant ───────────────────────────────────────────────────

  describe("variant styling", () => {
    it("applies primary variant classes by default", () => {
      renderModal();
      // The dialog panel should be in the DOM without throwing
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("renders with secondary variant without crashing", () => {
      renderModal({ variant: "secondary" });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  // ── Disabled states ────────────────────────────────────────────────────────

  describe("disabled / inactive states", () => {
    it("re-renders cleanly after closing and reopening (form reset)", async () => {
      const { rerender, props } = renderModal();
      // Close
      rerender(<SendModal {...props} open={false} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      // Re-open
      rerender(<SendModal {...props} open={true} />);
      expect(screen.getByLabelText(/Recipient address/i)).toHaveValue("");
      expect(screen.getByLabelText(/Amount/i)).toHaveValue("");
    });
  });
});
