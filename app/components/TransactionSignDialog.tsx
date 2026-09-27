"use client";

import { useEffect, useId, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";
import { useDialogFocusManagement } from "../hooks/useDialogFocusManagement";

export type TransactionSignDialogStatus = "signing" | "failed";

export interface TransactionSignDialogProps {
  /** Whether the dialog is mounted at all (drives exit animations). */
  open: boolean;
  /** Which phase to render: waiting for a wallet prompt, or a failure. */
  status: TransactionSignDialogStatus;
  /** Human-readable wallet name, e.g. "Freighter". */
  providerName: string;
  /** Optional context line rendered under the heading. */
  description?: string;
  /** Required when `status === 'failed'`. */
  failureMessage?: string;
  /** Re-invokes the signing attempt (shown only on failure). */
  onRetry?: () => void;
  /** Closes the dialog (shown only on failure). */
  onDismiss?: () => void;
}

/**
 * Reusable signing overlay. Renders a non-dismissable "check your wallet"
 * state while a signature is pending, then flips to an actionable, keyboard
 *-focusable failure state. Styling is Tailwind-only (no inline styles).
 */
export function TransactionSignDialog({
  open,
  status,
  providerName,
  description,
  failureMessage,
  onRetry,
  onDismiss,
}: TransactionSignDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    if (status === "failed") {
      onDismiss?.();
    }
  };

  useDialogFocusManagement(open, handleClose, dialogRef);

  useEffect(() => {
    if (!open || status === "signing") return;
    dialogRef.current?.focus();
  }, [open, status]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          aria-busy={status === "signing"}
          ref={dialogRef}
          tabIndex={-1}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#12122a] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex items-start gap-3">
              {status === "signing" ? (
                <Loader2
                  className="w-5 h-5 text-violet-400 mt-1 flex-shrink-0 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className="w-5 h-5 text-amber-400 mt-1 flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              <div className="space-y-2">
                <h2 id={titleId} className="font-bold text-lg text-white">
                  {status === "signing"
                    ? `Waiting for ${providerName}`
                    : "Transaction signing failed"}
                </h2>
                <div
                  id={descriptionId}
                  className={
                    status === "signing"
                      ? "text-sm text-white/70"
                      : "text-sm text-amber-300/90"
                  }
                  aria-live={status === "failed" ? "assertive" : "polite"}
                >
                  {status === "signing"
                    ? description ??
                      `Check your ${providerName} wallet and approve the signature request.`
                    : failureMessage}
                </div>
              </div>
            </div>

            {status === "failed" && (
              <div className="flex gap-3 pt-2">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex-1 px-4 py-2 rounded-lg bg-violet-600/40 hover:bg-violet-600/50 text-white text-sm font-medium transition-colors"
                  >
                    Try Again
                  </button>
                )}
                {onDismiss && (
                  <button
                    onClick={onDismiss}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}