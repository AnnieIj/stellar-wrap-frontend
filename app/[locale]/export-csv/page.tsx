"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useWrapStore } from "@/app/store/wrapStore";
import {
  connectFreighter,
  getCurrentPublicKey,
  isFreighterInstalled,
  NetworkMismatchError,
  FreighterNotInstalledError,
  FREIGHTER_INSTALL_URL,
} from "@/app/utils/walletConnect";
import {
  buildTransactionCsvRows,
  buildDappCsvRows,
  buildVibeCsvRows,
  exportToCsv,
} from "@/src/utils/csvExport";
import { ProgressIndicator } from "@/app/components/ProgressIndicator";
import type { WrapResult } from "@/app/store/wrapStore";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Connection attempt timeout — reject after this many ms. */
const CONNECTION_TIMEOUT_MS = 15_000;

/** Rate-limit: disable connect button for this many ms after a failed attempt. */
const RETRY_COOLDOWN_MS = 3_000;

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionState =
  | "idle"
  | "checking"
  | "connecting"
  | "connected"
  | "error"
  | "not-installed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Truncate a Stellar public key for display: GAAAAA…ZZZZ */
function truncateKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

/**
 * Race a promise against a timeout.
 * Rejects with a timeout error if the deadline is reached first.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Connection timed out after ${ms / 1000}s. Please try again.`,
            ),
          ),
        ms,
      ),
    ),
  ]);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NetworkBadge({ network }: { network: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-600/60">
      {network}
    </span>
  );
}

interface ExportButtonProps {
  onClick: () => void;
  label: string;
  description: string;
  disabled: boolean;
}

function ExportButton({ onClick, label, description, disabled }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex items-start gap-4 w-full rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-4 text-left hover:border-[var(--color-theme-primary)] hover:bg-slate-800/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      aria-label={label}
    >
      <Download
        className="w-5 h-5 mt-0.5 text-slate-400 group-hover:text-[var(--color-theme-primary)] transition-colors shrink-0"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExportCsvPage() {
  const { network, result } = useWrapStore();

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryDisabledUntil, setRetryDisabledUntil] = useState<number>(0);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  // ── Check if already connected on mount ─────────────────────────────────────
  useEffect(() => {
    async function checkExistingConnection() {
      setConnectionState("checking");
      try {
        const installed = await isFreighterInstalled();
        if (!installed) {
          setConnectionState("not-installed");
          return;
        }
        const key = await getCurrentPublicKey();
        if (key) {
          setConnectedAddress(key);
          setConnectionState("connected");
        } else {
          setConnectionState("idle");
        }
      } catch {
        setConnectionState("idle");
      }
    }
    void checkExistingConnection();
  }, []);

  // ── Connect wallet ──────────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    // Respect retry cooldown
    if (Date.now() < retryDisabledUntil) return;

    setConnectionError(null);
    setConnectionState("connecting");

    try {
      const address = await withTimeout(
        connectFreighter(network),
        CONNECTION_TIMEOUT_MS,
      );
      setConnectedAddress(address);
      setConnectionState("connected");
    } catch (err: unknown) {
      setConnectionState("error");

      if (err instanceof FreighterNotInstalledError) {
        setConnectionState("not-installed");
        setConnectionError(
          "Freighter is not installed. Please install it to continue.",
        );
      } else if (err instanceof NetworkMismatchError) {
        setConnectionError(
          `Network mismatch: Freighter is on "${err.actual}" but the app is set to "${err.expected}". Switch networks in Freighter and try again.`,
        );
        setRetryDisabledUntil(Date.now() + RETRY_COOLDOWN_MS);
      } else if (err instanceof Error) {
        const msg = err.message;
        if (
          msg.toLowerCase().includes("rejected") ||
          msg.toLowerCase().includes("declined")
        ) {
          setConnectionError("Connection rejected by user.");
        } else if (msg.toLowerCase().includes("timed out")) {
          setConnectionError(msg);
        } else {
          setConnectionError(msg || "Failed to connect. Please try again.");
        }
        setRetryDisabledUntil(Date.now() + RETRY_COOLDOWN_MS);
      } else {
        setConnectionError("An unexpected error occurred. Please try again.");
        setRetryDisabledUntil(Date.now() + RETRY_COOLDOWN_MS);
      }
    }
  }, [network, retryDisabledUntil]);

  // ── Export handlers ─────────────────────────────────────────────────────────
  const handleExportTransactions = useCallback(() => {
    if (!result) {
      setExportFeedback("No wrap data available. Complete the wrap flow first.");
      return;
    }
    const rows = buildTransactionCsvRows(result as WrapResult);
    exportToCsv(`stellar-wrap-transactions-${Date.now()}.csv`, rows);
    setExportFeedback("Transaction history exported.");
    setTimeout(() => setExportFeedback(null), 3000);
  }, [result]);

  const handleExportDapps = useCallback(() => {
    if (!result) {
      setExportFeedback("No wrap data available. Complete the wrap flow first.");
      return;
    }
    const rows = buildDappCsvRows(result as WrapResult);
    exportToCsv(`stellar-wrap-dapps-${Date.now()}.csv`, rows);
    setExportFeedback("dApp interactions exported.");
    setTimeout(() => setExportFeedback(null), 3000);
  }, [result]);

  const handleExportVibes = useCallback(() => {
    if (!result) {
      setExportFeedback("No wrap data available. Complete the wrap flow first.");
      return;
    }
    const rows = buildVibeCsvRows(result as WrapResult);
    exportToCsv(`stellar-wrap-vibes-${Date.now()}.csv`, rows);
    setExportFeedback("Vibe summary exported.");
    setTimeout(() => setExportFeedback(null), 3000);
  }, [result]);

  const isConnected = connectionState === "connected" && !!connectedAddress;
  const isConnecting =
    connectionState === "connecting" || connectionState === "checking";
  const retryDisabled = Date.now() < retryDisabledUntil;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen bg-[var(--background)] text-[var(--foreground)]"
      id="main-content"
    >
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            Export CSV
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
            Connect your Freighter wallet, then export your Stellar wrap
            data as CSV files. Amounts are formatted in XLM with 7 decimal
            precision (Stellar&rsquo;s native stroop precision).
          </p>
        </div>

        <div className="mb-8">
          <ProgressIndicator currentPage="export-csv" />
        </div>

        {/* Wallet connection section */}
        <section
          className="mb-8 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-6"
          aria-label="Wallet connection"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">Wallet Connection</h2>
            <NetworkBadge network={network} />
          </div>

          {/* Connected state */}
          {isConnected && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-xl bg-emerald-950/40 border border-emerald-700/50 px-4 py-3"
              role="status"
            >
              <CheckCircle
                className="w-5 h-5 text-emerald-400 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  Freighter connected
                </p>
                <p
                  className="text-xs text-slate-400 font-mono mt-0.5"
                  title={connectedAddress ?? ""}
                  aria-label={`Connected address: ${connectedAddress ?? ""}`}
                >
                  {connectedAddress ? truncateKey(connectedAddress) : ""}
                </p>
              </div>
            </motion.div>
          )}

          {/* Checking existing connection */}
          {connectionState === "checking" && (
            <div
              className="flex items-center gap-3 text-slate-400 text-sm"
              aria-live="polite"
            >
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Checking wallet status…
            </div>
          )}

          {/* Not installed */}
          {connectionState === "not-installed" && (
            <div
              className="flex flex-col gap-3"
              role="alert"
              aria-label="Freighter not installed"
            >
              <p className="text-sm text-slate-300">
                Freighter is not installed. Install the browser extension to
                connect your wallet.
              </p>
              <a
                href={FREIGHTER_INSTALL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
              >
                Install Freighter
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          )}

          {/* Idle / error — show connect button */}
          {(connectionState === "idle" || connectionState === "error") && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-300">
                Connect your Freighter wallet to authenticate and enable
                CSV exports.
              </p>
              <button
                onClick={handleConnect}
                disabled={isConnecting || retryDisabled}
                className="self-start inline-flex items-center gap-2 rounded-xl bg-[var(--color-theme-primary)] px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                aria-busy={isConnecting}
              >
                <Wallet className="w-4 h-4" aria-hidden="true" />
                Connect Freighter
              </button>
            </div>
          )}

          {/* Connecting spinner */}
          {connectionState === "connecting" && (
            <div
              className="flex items-center gap-3 text-slate-400 text-sm"
              aria-live="polite"
              aria-label="Connecting to Freighter"
            >
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Awaiting Freighter approval…
            </div>
          )}

          {/* Connection error */}
          <AnimatePresence>
            {connectionError && (
              <motion.div
                key="conn-error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-700/50 rounded-xl px-4 py-3"
                role="alert"
              >
                <XCircle
                  className="w-4 h-4 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{connectionError}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Export options — shown once wallet connected */}
        <AnimatePresence>
          {isConnected && (
            <motion.section
              key="export-options"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              aria-label="Export options"
              className="mb-6"
            >
              <h2 className="text-base font-bold mb-4">Export Options</h2>

              {!result && (
                <div
                  className="mb-4 flex items-start gap-2 text-sm text-yellow-300 bg-yellow-950/30 border border-yellow-700/50 rounded-xl px-4 py-3"
                  role="alert"
                >
                  <AlertCircle
                    className="w-4 h-4 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    No wrap data found. Complete the{" "}
                    <a
                      href="/connect"
                      className="underline underline-offset-2 hover:text-yellow-200"
                    >
                      wrap flow
                    </a>{" "}
                    first to generate exportable data.
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <ExportButton
                  onClick={handleExportTransactions}
                  label="Export Transaction History"
                  description="Total transactions, volume, percentile, largest transaction, and persona — formatted in XLM (7 decimal precision)."
                  disabled={!result}
                />
                <ExportButton
                  onClick={handleExportDapps}
                  label="Export dApp Interactions"
                  description="List of dApps you interacted with and your interaction counts."
                  disabled={!result}
                />
                <ExportButton
                  onClick={handleExportVibes}
                  label="Export Vibe Summary"
                  description="Your on-chain vibe breakdown with percentage scores."
                  disabled={!result}
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Export feedback toast */}
        <AnimatePresence>
          {exportFeedback && (
            <motion.div
              key="export-feedback"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-600/60 px-5 py-3 text-sm font-semibold text-[var(--foreground)] shadow-xl"
              role="status"
              aria-live="polite"
            >
              <CheckCircle
                className="w-4 h-4 text-emerald-400"
                aria-hidden="true"
              />
              {exportFeedback}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
