"use client";

/**
 * SendModal
 *
 * A modal dialog that lets the user send XLM (or any Stellar asset) to a
 * destination address. It validates the recipient address, amount, and memo
 * before allowing submission, and exposes success / error feedback inline.
 *
 * Design constraints
 * ──────────────────
 * - No inline styles.  All visual tokens use Tailwind + globals.css vars.
 * - No `any`.  All types are explicit.
 * - Accessible: role="dialog", aria-modal, focus-trap on open, Escape closes.
 * - Dark / light theme via CSS custom properties.
 * - Interactive states (hover, focus, active, disabled) fully styled.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle, Loader2, X } from "lucide-react";
import { useDialogFocusManagement } from "@/app/hooks/useDialogFocusManagement";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SendModalVariant = "primary" | "secondary";

export type SendStatus = "idle" | "submitting" | "success" | "error";

export interface SendModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Called when the user dismisses the modal (Escape, backdrop, or close button). */
  onClose: () => void;
  /**
   * Called when the user confirms the send.  Receives the validated fields.
   * Should return a Promise that resolves on success or rejects with an Error.
   */
  onSend: (params: SendParams) => Promise<void>;
  /** Pre-fill the recipient address (e.g. from a contact). */
  defaultRecipient?: string;
  /** Pre-fill the amount. */
  defaultAmount?: string;
  /** Asset code shown in the amount field (default: "XLM"). */
  assetCode?: string;
  /** Visual density variant. */
  variant?: SendModalVariant;
  /** Optional class names for the dialog panel. */
  className?: string;
}

export interface SendParams {
  recipient: string;
  amount: string;
  memo: string;
  assetCode: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Stellar public keys are 56 characters and start with 'G'. */
function isValidStellarAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value.trim());
}

/** Amount must be a positive number with up to 7 decimal places. */
function isValidAmount(value: string): boolean {
  return /^\d+(\.\d{1,7})?$/.test(value.trim()) && parseFloat(value) > 0;
}

/** Stellar memo text is limited to 28 UTF-8 bytes. */
function isValidMemo(value: string): boolean {
  return new TextEncoder().encode(value).length <= 28;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
  maxLength?: number;
  required?: boolean;
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  disabled = false,
  inputMode,
  type = "text",
  maxLength,
  required = false,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-white/70"
      >
        {label}
        {required && (
          <span className="ml-1 text-red-400" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={[
          "w-full rounded-xl border px-4 py-2.5 text-sm font-mono transition-colors",
          "bg-slate-900/70 text-white placeholder:text-white/25",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-theme-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-red-500/60 focus-visible:ring-red-500"
            : "border-white/10 hover:border-white/20 focus:border-[var(--color-theme-primary)]/50",
        ]
          .filter(Boolean)
          .join(" ")}
      />

      {hint && !error && (
        <p id={hintId} className="text-xs text-white/30">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SendModal({
  open,
  onClose,
  onSend,
  defaultRecipient = "",
  defaultAmount = "",
  assetCode = "XLM",
  variant = "primary",
  className = "",
}: SendModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [recipient, setRecipient] = useState(defaultRecipient);
  const [amount, setAmount] = useState(defaultAmount);
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [touched, setTouched] = useState({
    recipient: false,
    amount: false,
    memo: false,
  });

  // Reset form whenever the modal opens
  useEffect(() => {
    if (open) {
      setRecipient(defaultRecipient);
      setAmount(defaultAmount);
      setMemo("");
      setStatus("idle");
      setSubmitError(null);
      setTouched({ recipient: false, amount: false, memo: false });
    }
  }, [open, defaultRecipient, defaultAmount]);

  const handleClose = useCallback(() => {
    if (status === "submitting") return; // block close while tx in-flight
    onClose();
  }, [status, onClose]);

  useDialogFocusManagement(open, handleClose, dialogRef);

  // ── Validation ─────────────────────────────────────────────────────────────
  const recipientError =
    touched.recipient && recipient && !isValidStellarAddress(recipient)
      ? "Enter a valid Stellar address (starts with G, 56 chars)"
      : null;

  const amountError =
    touched.amount && amount && !isValidAmount(amount)
      ? "Enter a positive amount with up to 7 decimal places"
      : null;

  const memoError =
    touched.memo && memo && !isValidMemo(memo)
      ? "Memo must be ≤ 28 UTF-8 bytes"
      : null;

  const isFormValid =
    isValidStellarAddress(recipient) &&
    isValidAmount(amount) &&
    isValidMemo(memo);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTouched({ recipient: true, amount: true, memo: true });
      if (!isFormValid) return;

      setStatus("submitting");
      setSubmitError(null);

      try {
        await onSend({ recipient: recipient.trim(), amount: amount.trim(), memo, assetCode });
        setStatus("success");
      } catch (err) {
        setStatus("error");
        setSubmitError(
          err instanceof Error ? err.message : "Transaction failed. Please try again.",
        );
      }
    },
    [isFormValid, onSend, recipient, amount, memo, assetCode],
  );

  const panelVariant =
    variant === "primary"
      ? "bg-[var(--background)] border border-white/10"
      : "bg-slate-900/80 border border-white/5 backdrop-blur-md";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={dialogRef}
          tabIndex={-1}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className={[
              "w-full max-w-md rounded-2xl p-6 space-y-5",
              "sm:rounded-2xl rounded-t-2xl rounded-b-none sm:rounded-b-2xl",
              panelVariant,
              className,
            ].join(" ")}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2
                id={titleId}
                className="text-lg font-extrabold tracking-tight text-white"
              >
                Send {assetCode}
              </h2>
              <button
                onClick={handleClose}
                disabled={status === "submitting"}
                aria-label="Close send modal"
                className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--color-theme-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Success state */}
            {status === "success" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-6 text-center"
                role="status"
              >
                <CheckCircle
                  className="h-12 w-12 text-emerald-400"
                  aria-hidden="true"
                />
                <p className="text-base font-bold text-white">
                  Transaction submitted!
                </p>
                <p className="text-sm text-white/50">
                  Your {assetCode} is on its way.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-2 rounded-xl bg-[var(--color-theme-primary)] px-6 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-theme-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Done
                </button>
              </motion.div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <Field
                  id="send-modal-recipient"
                  label="Recipient address"
                  value={recipient}
                  onChange={(v) => {
                    setRecipient(v);
                    setTouched((t) => ({ ...t, recipient: true }));
                  }}
                  placeholder="G…"
                  error={recipientError}
                  hint="56-character Stellar public key"
                  disabled={status === "submitting"}
                  required
                />
                <Field
                  id="send-modal-amount"
                  label={`Amount (${assetCode})`}
                  value={amount}
                  onChange={(v) => {
                    setAmount(v);
                    setTouched((t) => ({ ...t, amount: true }));
                  }}
                  placeholder="0.0000000"
                  error={amountError}
                  disabled={status === "submitting"}
                  inputMode="decimal"
                  required
                />
                <Field
                  id="send-modal-memo"
                  label="Memo (optional)"
                  value={memo}
                  onChange={(v) => {
                    setMemo(v);
                    setTouched((t) => ({ ...t, memo: true }));
                  }}
                  placeholder="Up to 28 bytes"
                  error={memoError}
                  hint={`${new TextEncoder().encode(memo).length} / 28 bytes`}
                  disabled={status === "submitting"}
                  maxLength={64}
                />

                {/* Submit error */}
                <AnimatePresence>
                  {submitError && (
                    <motion.div
                      key="submit-error"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-2 rounded-xl border border-red-700/50 bg-red-950/40 px-4 py-3 text-sm text-red-300"
                      role="alert"
                    >
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{submitError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={status === "submitting"}
                    className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:border-white/20 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[var(--color-theme-primary)] disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    aria-busy={status === "submitting"}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-theme-primary)] px-4 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-theme-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                  >
                    {status === "submitting" ? (
                      <>
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        Sending…
                      </>
                    ) : (
                      <>
                        Send
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SendModal;
