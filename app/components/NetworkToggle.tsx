"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network as NetworkIcon, Loader2, AlertCircle, X } from 'lucide-react';
import { useWrapStore } from '../store/wrapStore';
import { NETWORKS, Network } from '../../src/config';
import { getNetworkDisplayName } from '../../src/utils/networkUtils';
import { clearContractCache } from '../utils/contractBridge';
import { useDialogFocusManagement } from '../hooks/useDialogFocusManagement';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { verifyWalletForNetwork } from '../services/transactionSigner';

/** Upper bound for the wallet re-check on the toggle so its state never hangs. */
const NETWORK_TOGGLE_GUARD_TIMEOUT_MS = 10_000;

export function NetworkToggle() {
  const {
    network,
    status,
    phase,
    switchError,
    failureReason,
    beginOptimisticSwitch,
    commitNetworkSwitch,
    rollbackNetworkSwitch,
    clearNetworkSwitchError,
  } = useWrapStore();

  const { isRateLimited } = useRateLimitStore();

  // ── Refs for async lifecycle management ──────────────────────────────────

  /** AbortController for the in-flight confirmation step. */
  const abortRef = useRef<AbortController | null>(null);

  /** Timer for the overall switch timeout. */
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Timer for auto-clearing the committed / error phases. */
  const autoClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Whether the confirmation dialog for an active-session switch is open. */
  const [showConfirmation, setShowConfirmation] = useState(false);

  /** Pending network the confirmation dialog is waiting on. */
  const [pendingNetwork, setPendingNetwork] = useState<Network | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // ── Cleanup helpers ───────────────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (autoClearRef.current !== null) {
      clearTimeout(autoClearRef.current);
      autoClearRef.current = null;
    }
  }, []);

  const abortInFlight = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    clearTimers();
  }, [clearTimers]);

  // Abort in-flight operations on unmount
  useEffect(() => {
    return () => {
      abortInFlight();
    };
  }, [abortInFlight]);

  // Auto-clear committed phase after a short success flash
  useEffect(() => {
    if (phase === "committed") {
      autoClearRef.current = setTimeout(() => {
        clearNetworkSwitchError(); // also resets phase → idle
      }, COMMIT_CLEAR_MS);
    }
    return () => {
      if (autoClearRef.current !== null) {
        clearTimeout(autoClearRef.current);
        autoClearRef.current = null;
      }
    };
  }, [phase, clearNetworkSwitchError]);

  // Auto-dismiss error banner
  useEffect(() => {
    if (phase === "rolled-back" && ERROR_AUTO_DISMISS_MS > 0) {
      autoClearRef.current = setTimeout(() => {
        clearNetworkSwitchError();
      }, ERROR_AUTO_DISMISS_MS);
    }
    return () => {
      if (autoClearRef.current !== null) {
        clearTimeout(autoClearRef.current);
        autoClearRef.current = null;
      }
    };
  }, [phase, clearNetworkSwitchError]);

  // ── Core switch logic ─────────────────────────────────────────────────────

  const performOptimisticSwitch = useCallback(
    async (newNetwork: Network) => {
      // Abort any previous in-flight switch
      abortInFlight();

      const controller = new AbortController();
      abortRef.current = controller;

      // 1. Apply the optimistic update immediately (UI shows new network now)
      beginOptimisticSwitch(newNetwork);

      // 2. Start the timeout watchdog
      timeoutRef.current = setTimeout(() => {
        abortRef.current?.abort();
        rollbackNetworkSwitch(
          "timeout",
          getErrorCopy("timeout"),
        );
      }, SWITCH_TIMEOUT_MS);

      // 3. Run async confirmation
      try {
        await confirmNetworkSwitch(newNetwork, isRateLimited, controller.signal);

        // Success — clear timeout and commit
        clearTimers();
        commitNetworkSwitch();
      } catch (err: unknown) {
        // Determine failure reason from the thrown value
        const reason: NetworkSwitchFailureReason =
          err !== null &&
          typeof err === "object" &&
          "failureReason" in err &&
          typeof (err as Record<string, unknown>).failureReason === "string"
            ? ((err as Record<string, unknown>).failureReason as NetworkSwitchFailureReason)
            : "unknown";

        clearTimers();

        // Do not double-rollback if timeout already triggered
        if (controller.signal.aborted) return;

        rollbackNetworkSwitch(reason, getErrorCopy(reason));
      } finally {
        abortRef.current = null;
      }
    },
    [
      abortInFlight,
      beginOptimisticSwitch,
      clearTimers,
      commitNetworkSwitch,
      isRateLimited,
      rollbackNetworkSwitch,
    ],
  );

  // ── Button click → dialog or immediate switch ─────────────────────────────

  const handleToggleClick = useCallback(() => {
    if (phase === "switching") return; // already switching, ignore

    const newNetwork: Network =
      network === NETWORKS.MAINNET ? NETWORKS.TESTNET : NETWORKS.MAINNET;

    if (status === "loading" || status === "ready") {
      // Show confirmation dialog for active sessions
      setPendingNetwork(newNetwork);
      setShowConfirmation(true);
    } else {
      void performOptimisticSwitch(newNetwork);
    }
  }, [phase, network, status, performOptimisticSwitch]);

  const handleConfirm = useCallback(() => {
    setShowConfirmation(false);
    if (pendingNetwork) {
      const target = pendingNetwork;
      setPendingNetwork(null);
      void performOptimisticSwitch(target);
    }
  }, [pendingNetwork, performOptimisticSwitch]);

  const handleCancel = useCallback(() => {
    setShowConfirmation(false);
    setPendingNetwork(null);
  }, []);

  useDialogFocusManagement(showConfirmation, handleCancel, dialogRef);

  const isMainnet = network === NETWORKS.MAINNET;
  const isBusy = isSwitchingDirect || isSigningSwitch;

  const networkColor = isMainnet ? "var(--color-theme-primary)" : "#FFA500";
  const networkColorRgb = isMainnet
    ? "var(--color-theme-primary-rgb)"
    : "255, 165, 0";
  const borderColor = isMainnet
    ? "rgba(var(--color-theme-primary-rgb), 0.3)"
    : "rgba(255, 165, 0, 0.3)";
  const glowColor = isMainnet
    ? "rgba(var(--color-theme-primary-rgb), 0.3)"
    : "rgba(255, 165, 0, 0.3)";
  const pulseFrom = `rgba(${networkColorRgb}, 0.5)`;
  const pulseTo = `rgba(${networkColorRgb}, 1)`;

  return (
    <>
      {/* ── Toggle button ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="fixed top-4 right-4 md:top-8 md:right-24 z-50"
      >
        <motion.button
          type="button"
          onClick={handleToggleClick}
          disabled={isSwitching}
          aria-label={
            isSwitching
              ? "Switching network…"
              : `Switch to ${isMainnet ? "Testnet" : "Mainnet"}`
          }
          aria-live="polite"
          aria-atomic="true"
          className="group relative flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-xl backdrop-blur-xl border transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            borderColor,
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Glow effect */}
          <motion.div
            className="absolute -inset-1 rounded-xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity"
            style={{ backgroundColor: glowColor }}
          />

          {/* Icon */}
          <div className="relative flex items-center justify-center min-w-[1.25rem] min-h-[1.25rem] md:min-w-5 md:min-h-5">
            <AnimatePresence mode="wait">
              {isSwitching ? (
                <motion.span
                  key="spinner"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Loader2
                    className="w-4 h-4 md:w-5 md:h-5 animate-spin"
                    style={{ color: networkColor }}
                  />
                </motion.span>
              ) : phase === "committed" ? (
                <motion.span
                  key="check"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <CheckCircle2
                    className="w-4 h-4 md:w-5 md:h-5"
                    style={{ color: networkColor }}
                  />
                </motion.span>
              ) : (
                <motion.span
                  key="icon"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <NetworkIcon
                    className="w-4 h-4 md:w-5 md:h-5"
                    style={{ color: networkColor }}
                  />
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Label */}
          <div className="relative flex flex-col items-start">
            <span className="text-[8px] md:text-[10px] font-black tracking-wider text-white/80 uppercase">
              Network
            </span>
            <span
              className="text-xs md:text-sm font-black tracking-tight"
              style={{ color: networkColor }}
            >
              {isSwitching
                ? "Switching…"
                : phase === "committed"
                  ? `${getNetworkDisplayName(network)} ✓`
                  : getNetworkDisplayName(network)}
            </span>
          </div>

          {/* Pulse dot */}
          <motion.div
            className="relative w-2 h-2 rounded-full"
            style={{ backgroundColor: networkColor }}
            animate={{
              opacity: [0.5, 1, 0.5],
              boxShadow: [
                `0 0 5px ${pulseFrom}`,
                `0 0 10px ${pulseTo}`,
                `0 0 5px ${pulseFrom}`,
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.button>
      </motion.div>

      {/* ── Error / rollback banner ─────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "rolled-back" && switchError && (
          <motion.div
            key="error-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 md:right-24 z-50 flex items-start gap-3 max-w-sm w-full rounded-xl px-4 py-3 border border-red-500/40 bg-black/80 backdrop-blur-xl shadow-lg"
            role="alert"
            aria-live="assertive"
          >
            <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-300 flex-1 leading-relaxed">
              {failureReason === "rate-limited" ? (
                <>
                  <span className="font-bold">Rate limited.</span>{" "}
                  {switchError}
                </>
              ) : (
                switchError
              )}
            </p>
            <button
              type="button"
              onClick={clearNetworkSwitchError}
              aria-label="Dismiss error"
              className="text-white/40 hover:text-white/80 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirmation dialog (active session) ───────────────────────────── */}
      <AnimatePresence>
        {showConfirmation && pendingNetwork && (
          <motion.div
            key="confirm-dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="network-switch-title"
            aria-describedby="network-switch-description"
            ref={dialogRef}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#12122a] border border-amber-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-1 flex-shrink-0" />
                <div>
                  <h2
                    id="network-switch-title"
                    className="font-bold text-lg text-amber-400"
                  >
                    Switch Networks?
                  </h2>
                  <p id="network-switch-description" className="text-sm text-white/70 mt-2">
                    You have an active wrap session. Switching networks will reset your current wrap data and restart indexing on {getNetworkDisplayName(pendingNetwork)}.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-500/30 hover:bg-amber-500/40 text-amber-400 text-sm font-medium transition-colors"
                >
                  Switch Network
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
