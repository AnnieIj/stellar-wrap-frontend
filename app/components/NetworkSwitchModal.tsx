"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  XCircle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { Network } from "../../src/config";
import { getNetworkDisplayName } from "../../src/utils/networkUtils";
import {
  NetworkSwitchStatus,
  NetworkSwitchError,
  WalletProviderType,
} from "../../src/services/networkSwitchService";

export interface NetworkSwitchModalProps {
  isOpen: boolean;
  targetNetwork: Network;
  currentNetwork: Network;
  status: NetworkSwitchStatus;
  walletProvider: WalletProviderType;
  formattedFee: string;
  progressMessage?: string;
  error: NetworkSwitchError | null;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry?: () => void;
}

export function NetworkSwitchModal({
  isOpen,
  targetNetwork,
  currentNetwork,
  status,
  walletProvider,
  formattedFee,
  progressMessage,
  error,
  onConfirm,
  onCancel,
  onRetry,
}: NetworkSwitchModalProps) {
  if (!isOpen) return null;

  const isSwitching =
    status === "preparing" ||
    status === "simulating" ||
    status === "waiting_for_signature" ||
    status === "submitting";

  const isRejected = status === "rejected" || (error?.isRejection ?? false);
  const isTimeout = status === "timeout" || (error?.isTimeout ?? false);
  const isError = status === "error" && !isRejected && !isTimeout;
  const isConfirmed = status === "confirmed";

  const walletDisplayName =
    walletProvider === "freighter"
      ? "Freighter"
      : walletProvider === "albedo"
      ? "Albedo"
      : walletProvider === "xbull"
      ? "xBull"
      : "Connected Wallet";

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="network-switch-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md rounded-2xl bg-[#0e0e1a] border border-white/10 p-6 shadow-2xl space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id="network-switch-modal-title"
                  className="text-lg font-bold text-white tracking-tight"
                >
                  Network Switch
                </h2>
                <p className="text-xs text-white/50">
                  Signing via {walletDisplayName}
                </p>
              </div>
            </div>

            {/* Network Transition Badge */}
            <div className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-xs font-semibold">
              <span className="text-white/60">{getNetworkDisplayName(currentNetwork)}</span>
              <ArrowRight className="h-3 w-3 text-white/40" />
              <span className="text-amber-400">{getNetworkDisplayName(targetNetwork)}</span>
            </div>
          </div>

          {/* Body based on Status */}
          {status === "idle" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-white/80 space-y-1">
                  <p className="font-semibold text-amber-300">Active Wrap Session Notice</p>
                  <p>
                    Switching to {getNetworkDisplayName(targetNetwork)} will reset your active session. You will be prompted to sign the switch transaction in {walletDisplayName}.
                  </p>
                </div>
              </div>

              {/* Fee Information with 7 decimal precision / Stroops */}
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Estimated Network Fee:</span>
                  <span className="font-mono font-medium text-emerald-400">
                    {formattedFee}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Security Verification:</span>
                  <span className="flex items-center gap-1 text-indigo-300">
                    <ShieldCheck className="h-3.5 w-3.5" /> Zero-Transfer State Proof
                  </span>
                </div>
              </div>
            </div>
          )}

          {isSwitching && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-indigo-400 animate-spin" />
                <div className="absolute inset-0 rounded-full blur-md bg-indigo-500/20 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  {status === "waiting_for_signature"
                    ? `Please approve signature in ${walletDisplayName}`
                    : "Processing Network Switch"}
                </p>
                <p className="text-xs text-white/60">
                  {progressMessage || "Interacting with Stellar network..."}
                </p>
              </div>
              <div className="text-[11px] font-mono text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-1">
                Fee: {formattedFee}
              </div>
            </div>
          )}

          {isRejected && (
            <div className="space-y-4">
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 flex items-start gap-3">
                <XCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-rose-300">Signature Rejected</p>
                  <p className="text-white/70">
                    {error?.userMessage || `Transaction signature was rejected in ${walletDisplayName}. Network switch was cancelled.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isTimeout && (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-amber-300">Connection Timeout</p>
                  <p className="text-white/70">
                    {error?.userMessage || "Wallet response timed out. Please verify your wallet is unlocked and try again."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isError && (
            <div className="space-y-4">
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-rose-300">Switch Error</p>
                  <p className="text-white/70">
                    {error?.userMessage || "An error occurred while switching networks. Please try again."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isConfirmed && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Network Switched!</p>
                <p className="text-xs text-white/60">
                  Successfully switched to {getNetworkDisplayName(targetNetwork)}.
                </p>
              </div>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            {status === "idle" && (
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 text-xs font-semibold text-white/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black py-2.5 text-xs font-bold transition-all shadow-lg shadow-amber-500/20"
                >
                  Sign & Switch
                </button>
              </>
            )}

            {isSwitching && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 text-xs font-semibold text-white/70 transition-colors"
              >
                Cancel Signing
              </button>
            )}

            {(isRejected || isTimeout || isError) && (
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 text-xs font-semibold text-white/80 transition-colors"
                >
                  Dismiss
                </button>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 py-2.5 text-xs font-bold transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retry Signing
                  </button>
                )}
              </>
            )}

            {isConfirmed && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 py-2.5 text-xs font-bold transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
