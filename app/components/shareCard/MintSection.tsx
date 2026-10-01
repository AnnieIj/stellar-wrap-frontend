"use client";

import { motion } from "motion/react";
import {
  Loader2,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { MintTransactionState } from "./shareCardUtils";

export interface MintSectionProps {
  /** Current state of the minting transaction. */
  transactionState: MintTransactionState;
  /** Transaction hash once confirmed (used for the explorer link). */
  transactionHash: string | null;
  /** Current polling-attempt count while awaiting on-chain confirmation. */
  confirmingAttempt: number | null;
  /** True when the confirmation window has timed out. */
  confirmingTimedOut: boolean;
  /** Whether the app currently has a network connection. */
  isOnline: boolean;
  /** The Stellar network ("mainnet" | "testnet"). */
  network: string;
  /** Mint button label (pre-computed by the parent via getMintButtonText). */
  mintButtonLabel: string;
  /** Called when the user clicks the Mint / Retry button. */
  onMint: () => void;
}

/**
 * Renders the Mint button, confirming-progress bar, and timeout/error banners.
 *
 * All state is passed in as props so this component is easy to snapshot-test
 * and to reuse in Storybook without needing the transaction store.
 */
export function MintSection({
  transactionState,
  transactionHash,
  confirmingAttempt,
  confirmingTimedOut,
  isOnline,
  network,
  mintButtonLabel,
  onMint,
}: MintSectionProps) {
  const t = useTranslations("ShareCard");

  const isMinting = [
    "building",
    "simulating",
    "signing",
    "submitting",
    "confirming",
  ].includes(transactionState);

  const mintSuccess =
    transactionState === "confirmed" ? transactionHash : null;
  const mintFailed = transactionState === "failed";

  return (
    <>
      {/* Polling progress bar — shown while awaiting on-chain confirmation */}
      {confirmingAttempt !== null && !confirmingTimedOut && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mt-6 rounded-xl border border-white/10 bg-black/40 p-4"
          aria-live="polite"
          aria-label={`Confirming transaction, attempt ${confirmingAttempt} of 60`}
        >
          <div className="flex justify-between text-xs text-white/60 mb-2">
            <span>Waiting for confirmation on-chain…</span>
            <span>{confirmingAttempt} / 60</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: "var(--color-theme-primary)" }}
              animate={{
                width: `${Math.round((confirmingAttempt / 60) * 100)}%`,
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      )}

      {/* Timeout banner — shown when the confirmation window expired */}
      {confirmingTimedOut && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="w-5 h-5 text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-bold text-amber-200">
                Confirmation is taking longer than expected
              </p>
              <p className="text-xs text-amber-200/70 mt-1">
                Your transaction may still go through — check the explorer
                before retrying to avoid a duplicate.
              </p>
            </div>
          </div>
          {transactionHash && (
            <a
              href={`https://stellar.expert/explorer/${
                network === "mainnet" ? "public" : "testnet"
              }/tx/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-100 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              View transaction on Stellar.expert
            </a>
          )}
        </motion.div>
      )}

      {/* Mint button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        whileHover={{
          scale: !isOnline || isMinting || !!mintSuccess ? 1 : 1.02,
          transition: { duration: 0.2 },
        }}
        whileTap={{
          scale: !isOnline || isMinting || !!mintSuccess ? 1 : 0.98,
        }}
        className={`w-full group relative mt-8 ${mintFailed ? "animate-pulse" : ""}`}
        onClick={onMint}
        aria-label={mintButtonLabel}
      >
        {/* Glow halo */}
        <motion.div
          className={`absolute -inset-1 rounded-2xl blur-xl transition-opacity ${
            mintFailed
              ? "opacity-50"
              : "opacity-0 group-hover:opacity-100"
          }`}
          style={{
            backgroundColor: mintFailed
              ? "rgba(239, 68, 68, 0.5)"
              : "var(--color-theme-primary)",
          }}
        />

        {/* Button surface */}
        <div
          className="relative flex items-center justify-center gap-3 sm:gap-4 backdrop-blur-sm text-white px-6 sm:px-8 py-4 sm:py-6 rounded-2xl border border-white/20 transition-colors"
          style={{
            backgroundColor: mintFailed
              ? "rgba(239, 68, 68, 0.2)"
              : "rgba(var(--color-theme-primary-rgb), 0.2)",
            borderColor: mintFailed
              ? "rgba(239, 68, 68, 0.5)"
              : "rgba(255, 255, 255, 0.2)",
          }}
        >
          {isMinting ? (
            <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
          ) : mintFailed ? (
            <AlertCircle
              className="w-6 h-6 text-red-500"
              aria-hidden="true"
            />
          ) : (
            <Sparkles className="w-6 h-6" aria-hidden="true" />
          )}
          <span
            className={`text-lg sm:text-2xl font-black tracking-tight ${
              mintFailed ? "text-red-100" : ""
            } truncate`}
          >
            {mintButtonLabel}
          </span>
        </div>
      </motion.button>
    </>
  );
}
