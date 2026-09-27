/**
 * FreighterWalletPanel
 *
 * A self-contained, accessible UI panel for connecting a Freighter wallet
 * to the Liquidity Pool flow.
 *
 * It wires `useFreighterWallet` and renders one of four states:
 *   idle        – "Connect Wallet" button
 *   connecting  – spinner + progress label
 *   connected   – truncated public key, XLM balance, copy + disconnect actions
 *   error       – contextual error banner with a retry / install CTA
 *
 * Design decisions
 * ────────────────
 * - No inline styles. All visual styling uses Tailwind CSS classes and the
 *   project's CSS custom properties (defined in app/globals.css).
 * - No `any`. All types are explicit.
 * - Every interactive element has an `aria-label`.
 * - Status transitions are announced via `role="status"` (polite live region).
 * - Error messages use `role="alert"` (assertive, for immediate announcement).
 * - Focus is moved to the error dismiss button whenever an error appears.
 *
 * Props
 * ─────
 * @prop network        – "mainnet" | "testnet"; passed straight to the hook.
 * @prop onConnected    – Called with the full public key once connected.
 * @prop onDisconnected – Called when the user clicks disconnect.
 * @prop className      – Optional extra Tailwind classes for the root element.
 */

"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { useFreighterWallet } from "../hooks/useFreighterWallet";
import type { FreighterWalletError } from "../hooks/useFreighterWallet";
import type { Network } from "../config";

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <title>{label}</title>
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth={4}
      />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        fill="currentColor"
      />
    </svg>
  );
}

/** A small wallet icon used in the connect button. */
function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-2m-4-3h4m-4 0a1 1 0 000 2m0-2a1 1 0 010 2"
      />
    </svg>
  );
}

/** Check-circle icon used in the connected state. */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/** Copy icon. */
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
      />
    </svg>
  );
}

/** External link icon (used on the "Install Freighter" button). */
function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  error: FreighterWalletError;
  onRetry: () => void;
  dismissRef: React.RefObject<HTMLButtonElement | null>;
}

function ErrorBanner({ error, onRetry, dismissRef }: ErrorBannerProps) {
  const labelId = useId();

  return (
    <div
      role="alert"
      aria-labelledby={labelId}
      className="rounded-xl border border-red-500/30 bg-red-950/40 p-4"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <svg
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>

        <div className="flex-1 space-y-2">
          <p
            id={labelId}
            className="text-sm font-medium text-red-300"
          >
            {error.code === "NOT_INSTALLED" && "Freighter not installed"}
            {error.code === "USER_REJECTED" && "Connection declined"}
            {error.code === "NETWORK_MISMATCH" && "Network mismatch"}
            {error.code === "TIMEOUT" && "Connection timed out"}
            {error.code === "UNKNOWN" && "Connection failed"}
          </p>
          <p className="text-sm text-red-200/80">{error.message}</p>

          <div className="flex flex-wrap gap-2 pt-1">
            {/* Install link for NOT_INSTALLED */}
            {error.code === "NOT_INSTALLED" && error.installUrl && (
              <a
                href={error.installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-theme-primary)]"
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                Install Freighter
              </a>
            )}

            {/* Retry for REJECTED / TIMEOUT / UNKNOWN */}
            {error.code !== "NOT_INSTALLED" && (
              <button
                ref={dismissRef}
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                Try again
              </button>
            )}

            {/* For NETWORK_MISMATCH: surface both sides */}
            {error.code === "NETWORK_MISMATCH" && error.mismatch && (
              <span className="self-center rounded bg-white/5 px-2 py-1 font-mono text-[11px] text-foreground/60">
                Wallet:{" "}
                <span className="text-red-300">{error.mismatch.actual}</span>
                {" → "}
                App:{" "}
                <span className="text-emerald-300">{error.mismatch.expected}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Connected state card ─────────────────────────────────────────────────────

interface ConnectedCardProps {
  publicKey: string;
  shortKey: string;
  formattedBalance: string | null;
  isLoadingBalance: boolean;
  onDisconnect: () => void;
}

function ConnectedCard({
  publicKey,
  shortKey,
  formattedBalance,
  isLoadingBalance,
  onDisconnect,
}: ConnectedCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write failed — non-fatal, just don't update the icon
    }
  }, [publicKey]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        {/* Left: icon + address */}
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">
              Connected
            </p>
            <button
              type="button"
              onClick={handleCopy}
              title={copied ? "Copied!" : `Copy full address: ${publicKey}`}
              aria-label={copied ? "Address copied" : "Copy wallet address"}
              className="group mt-0.5 flex items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-theme-primary)] focus-visible:ring-offset-1"
            >
              <span className="font-mono text-sm text-foreground/90 group-hover:text-foreground">
                {shortKey}
              </span>
              <CopyIcon
                className={[
                  "h-3.5 w-3.5 transition-colors",
                  copied
                    ? "text-emerald-400"
                    : "text-foreground/40 group-hover:text-foreground/70",
                ].join(" ")}
              />
            </button>
          </div>
        </div>

        {/* Right: balance + disconnect */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Balance */}
          <div className="text-right">
            {isLoadingBalance ? (
              <span className="flex items-center gap-1 text-xs text-foreground/40">
                <Spinner label="Loading balance…" />
                <span>Balance…</span>
              </span>
            ) : formattedBalance ? (
              <span className="text-sm font-medium tabular-nums text-foreground/80">
                {formattedBalance}
              </span>
            ) : null}
          </div>

          {/* Disconnect */}
          <button
            type="button"
            onClick={onDisconnect}
            aria-label="Disconnect wallet"
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-foreground/40 transition-colors hover:bg-white/10 hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-theme-primary)]"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface FreighterWalletPanelProps {
  /** The Stellar network to connect on. */
  network?: Network;
  /** Callback fired with the full public key once the wallet is connected. */
  onConnected?: (publicKey: string) => void;
  /** Callback fired when the user clicks disconnect. */
  onDisconnected?: () => void;
  /** Additional Tailwind classes applied to the root element. */
  className?: string;
}

export function FreighterWalletPanel({
  network = "mainnet",
  onConnected,
  onDisconnected,
  className = "",
}: FreighterWalletPanelProps) {
  const {
    connectionState,
    publicKey,
    shortKey,
    formattedBalance,
    isLoadingBalance,
    error,
    connect,
    disconnect,
    retry,
  } = useFreighterWallet(network);

  // Focus the dismiss/retry button when an error appears.
  const dismissRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (connectionState === "error" && dismissRef.current) {
      dismissRef.current.focus();
    }
  }, [connectionState]);

  // Fire onConnected once the state transitions to "connected".
  useEffect(() => {
    if (connectionState === "connected" && publicKey) {
      onConnected?.(publicKey);
    }
  }, [connectionState, publicKey, onConnected]);

  // ── Disconnect handler ─────────────────────────────────────────────────────
  const handleDisconnect = useCallback(() => {
    disconnect();
    onDisconnected?.();
  }, [disconnect, onDisconnected]);

  // ── Accessibility live-region label ───────────────────────────────────────
  const statusLabel =
    connectionState === "connecting"
      ? "Connecting to Freighter wallet…"
      : connectionState === "connected"
        ? `Wallet connected: ${shortKey ?? publicKey}`
        : connectionState === "error"
          ? `Wallet connection failed: ${error?.message ?? ""}`
          : "";

  return (
    <div className={["flex flex-col gap-3", className].join(" ")}>
      {/* Polite live region for screen readers */}
      <p role="status" className="sr-only" aria-live="polite" aria-atomic="true">
        {statusLabel}
      </p>

      {/* ── idle / connecting state ── */}
      {(connectionState === "idle" || connectionState === "connecting") && (
        <button
          type="button"
          onClick={() => void connect()}
          disabled={connectionState === "connecting"}
          aria-busy={connectionState === "connecting"}
          aria-label={
            connectionState === "connecting"
              ? "Connecting to Freighter wallet…"
              : "Connect Freighter wallet"
          }
          className={[
            "flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3",
            "text-sm font-semibold transition-all duration-150",
            "bg-[color:var(--color-theme-primary)] text-white",
            "hover:brightness-110 active:scale-[0.98]",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-[color:var(--color-theme-primary)] focus-visible:ring-offset-2",
          ].join(" ")}
        >
          {connectionState === "connecting" ? (
            <>
              <Spinner label="Connecting…" />
              <span>Waiting for Freighter…</span>
            </>
          ) : (
            <>
              <WalletIcon className="h-5 w-5" />
              <span>Connect Freighter</span>
            </>
          )}
        </button>
      )}

      {/* ── connected state ── */}
      {connectionState === "connected" && publicKey && shortKey && (
        <ConnectedCard
          publicKey={publicKey}
          shortKey={shortKey}
          formattedBalance={formattedBalance}
          isLoadingBalance={isLoadingBalance}
          onDisconnect={handleDisconnect}
        />
      )}

      {/* ── error state ── */}
      {connectionState === "error" && error && (
        <>
          <ErrorBanner
            error={error}
            onRetry={retry}
            dismissRef={dismissRef}
          />

          {/* After an install-prompt error, also show a "retry after installing" button */}
          {error.code === "NOT_INSTALLED" && (
            <button
              type="button"
              onClick={retry}
              className={[
                "flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3",
                "text-sm font-semibold transition-all duration-150",
                "border border-white/10 bg-white/5 text-foreground/70",
                "hover:bg-white/10 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-[color:var(--color-theme-primary)] focus-visible:ring-offset-2",
              ].join(" ")}
            >
              <WalletIcon className="h-5 w-5" />
              <span>I&apos;ve installed Freighter — connect now</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default FreighterWalletPanel;
