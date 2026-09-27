/**
 * MultiSig — Self-contained multi-signature Soroban transaction panel.
 *
 * Wires the `useMultiSigWallet` hook to a three-phase UI:
 *   1. Propose  — form to set up contract method, co-signers, threshold.
 *   2. Sign     — per-signer status list, signature progress bar, sign CTA.
 *   3. Execute  — submit + confirmation polling display.
 *
 * Accessibility
 * ─────────────
 * - All interactive controls have `aria-label` / `aria-describedby`.
 * - Status messages use `role="status"` (polite live region).
 * - Error banners use `role="alert"` for immediate announcement.
 * - The confirmation progress bar uses `role="progressbar"` with aria values.
 * - Focus moves to the dismiss button whenever an error appears.
 *
 * Styling
 * ───────
 * All visual styling uses Tailwind CSS classes.  No inline styles are used.
 * Colour tokens reference the project's CSS custom properties (globals.css).
 */

'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useMultiSigWallet } from '../hooks/useMultiSigWallet';
import { useMultiSigStore } from '../store/multiSigStore';

import type { ProposeParams } from '../hooks/useMultiSigWallet';
import type { SignerStatus } from '../store/multiSigStore';
import type {
  MultiSigContractArgs,
  MultiSigContractMethod,
} from '../types/multiSig';

// ─── Utility components ───────────────────────────────────────────────────────

function Spinner({ label = 'Loading…' }: { label?: string }) {
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
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        fill="currentColor"
      />
    </svg>
  );
}

// ─── Signer row ───────────────────────────────────────────────────────────────

function SignerRow({ signer }: { signer: SignerStatus }) {
  const shortKey = `${signer.publicKey.slice(0, 8)}…${signer.publicKey.slice(-4)}`;
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-4 py-2.5 text-sm">
      <span
        className="font-mono text-xs text-foreground/70"
        title={signer.publicKey}
      >
        {shortKey}
        {signer.isProposer && (
          <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground/50">
            proposer
          </span>
        )}
      </span>
      {signer.hasSigned ? (
        <span
          className="flex items-center gap-1 text-emerald-400"
          aria-label="Signed"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
          <span className="text-xs">Signed</span>
        </span>
      ) : (
        <span className="text-xs text-foreground/40" aria-label="Awaiting signature">
          Pending
        </span>
      )}
    </li>
  );
}

// ─── Phase indicator ──────────────────────────────────────────────────────────

type PhaseKey = 'propose' | 'sign' | 'execute' | 'done';

function PhaseIndicator({ current }: { current: PhaseKey | 'idle' | 'error' }) {
  const steps: { key: PhaseKey; label: string }[] = [
    { key: 'propose', label: 'Propose' },
    { key: 'sign', label: 'Sign' },
    { key: 'execute', label: 'Execute' },
    { key: 'done', label: 'Done' },
  ];
  const order: PhaseKey[] = ['propose', 'sign', 'execute', 'done'];
  const currentIndex = order.indexOf(current as PhaseKey);

  return (
    <ol className="flex items-center" aria-label="Transaction phases">
      {steps.map(({ key, label }, i) => {
        const isPast = currentIndex > i;
        const isCurrent = currentIndex === i;
        return (
          <React.Fragment key={key}>
            <li
              className="flex flex-col items-center gap-1"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  isPast
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                      ? 'border-2 border-[color:var(--color-theme-primary)] bg-transparent text-foreground'
                      : 'bg-white/10 text-foreground/40',
                ].join(' ')}
              >
                {isPast ? (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={[
                  'text-[10px] font-medium uppercase tracking-wide',
                  isCurrent ? 'text-foreground' : 'text-foreground/40',
                ].join(' ')}
              >
                {label}
              </span>
            </li>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={[
                  'mb-4 h-px flex-1 transition-colors',
                  isPast ? 'bg-emerald-500' : 'bg-white/10',
                ].join(' ')}
              />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

// ─── Propose form ─────────────────────────────────────────────────────────────

interface ProposeFormProps {
  onSubmit: (params: ProposeParams) => void;
  isLoading: boolean;
}

function ProposeForm({ onSubmit, isLoading }: ProposeFormProps) {
  const formId = useId();
  const [method, setMethod] = useState<MultiSigContractMethod>('mint_wrap');
  const [contractAddress, setContractAddress] = useState('');
  const [signerInput, setSignerInput] = useState('');
  const [signers, setSigners] = useState<string[]>([]);
  const [threshold, setThreshold] = useState<number | ''>('');
  const [paramKey, setParamKey] = useState('');
  const [paramValue, setParamValue] = useState('');
  const [params, setParams] = useState<Record<string, string>>({});

  const addSigner = useCallback(() => {
    const trimmed = signerInput.trim();
    if (!trimmed || signers.includes(trimmed)) return;
    setSigners((prev) => [...prev, trimmed]);
    setSignerInput('');
  }, [signerInput, signers]);

  const removeSigner = useCallback((key: string) => {
    setSigners((prev) => prev.filter((s) => s !== key));
  }, []);

  const addParam = useCallback(() => {
    const k = paramKey.trim();
    const v = paramValue.trim();
    if (!k || !v) return;
    setParams((prev) => ({ ...prev, [k]: v }));
    setParamKey('');
    setParamValue('');
  }, [paramKey, paramValue]);

  const removeParam = useCallback((key: string) => {
    setParams((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const contractArgs: MultiSigContractArgs = { method, params };
      onSubmit({
        additionalSigners: signers,
        threshold: threshold !== '' ? threshold : undefined,
        contractAddress: contractAddress.trim() || undefined,
        contractArgs,
      });
    },
    [method, params, signers, threshold, contractAddress, onSubmit],
  );

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      aria-label="Create multi-sig proposal"
      noValidate
    >
      {/* Contract method */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${formId}-method`}
          className="text-xs font-semibold uppercase tracking-wide text-foreground/60"
        >
          Contract method
        </label>
        <select
          id={`${formId}-method`}
          value={method}
          onChange={(e) => setMethod(e.target.value as MultiSigContractMethod)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:border-[color:var(--color-theme-primary)] focus:outline-none"
          required
        >
          <option value="mint_wrap">mint_wrap</option>
          <option value="submit_stats">submit_stats</option>
          <option value="update_config">update_config</option>
          <option value="custom">custom</option>
        </select>
      </div>

      {/* Contract address (optional) */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${formId}-contract`}
          className="text-xs font-semibold uppercase tracking-wide text-foreground/60"
        >
          Contract address{' '}
          <span className="font-normal text-foreground/40">(optional — uses default if blank)</span>
        </label>
        <input
          id={`${formId}-contract`}
          type="text"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
          placeholder="CAAAA… (56 chars)"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-foreground placeholder:text-foreground/30 focus:border-[color:var(--color-theme-primary)] focus:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* Co-signers */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
          Co-signers
        </legend>
        <div className="flex gap-2">
          <input
            type="text"
            value={signerInput}
            onChange={(e) => setSignerInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSigner();
              }
            }}
            placeholder="G… public key"
            aria-label="Co-signer public key"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-foreground placeholder:text-foreground/30 focus:border-[color:var(--color-theme-primary)] focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={addSigner}
            aria-label="Add co-signer"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-theme-primary)]"
          >
            Add
          </button>
        </div>
        {signers.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label="Co-signers list">
            {signers.map((key) => (
              <li
                key={key}
                className="flex items-center justify-between rounded-md bg-white/5 px-3 py-1.5 font-mono text-xs text-foreground/70"
              >
                <span title={key}>
                  {key.slice(0, 8)}…{key.slice(-4)}
                </span>
                <button
                  type="button"
                  onClick={() => removeSigner(key)}
                  aria-label={`Remove signer ${key.slice(0, 8)}`}
                  className="ml-2 text-foreground/40 transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {/* Threshold */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${formId}-threshold`}
          className="text-xs font-semibold uppercase tracking-wide text-foreground/60"
        >
          Threshold{' '}
          <span className="font-normal text-foreground/40">
            (signatures required — default: all)
          </span>
        </label>
        <input
          id={`${formId}-threshold`}
          type="number"
          min={1}
          max={signers.length + 1}
          value={threshold}
          onChange={(e) =>
            setThreshold(e.target.value === '' ? '' : Number(e.target.value))
          }
          placeholder={`${signers.length + 1}`}
          className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:border-[color:var(--color-theme-primary)] focus:outline-none"
        />
      </div>

      {/* Contract params */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
          Contract parameters
        </legend>
        <div className="flex gap-2">
          <input
            type="text"
            value={paramKey}
            onChange={(e) => setParamKey(e.target.value)}
            placeholder="key"
            aria-label="Parameter key"
            className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-foreground placeholder:text-foreground/30 focus:border-[color:var(--color-theme-primary)] focus:outline-none"
          />
          <input
            type="text"
            value={paramValue}
            onChange={(e) => setParamValue(e.target.value)}
            placeholder="value"
            aria-label="Parameter value"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-foreground placeholder:text-foreground/30 focus:border-[color:var(--color-theme-primary)] focus:outline-none"
          />
          <button
            type="button"
            onClick={addParam}
            aria-label="Add parameter"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-theme-primary)]"
          >
            Add
          </button>
        </div>
        {Object.keys(params).length > 0 && (
          <ul className="flex flex-col gap-1" aria-label="Parameters list">
            {Object.entries(params).map(([k, v]) => (
              <li
                key={k}
                className="flex items-center justify-between rounded-md bg-white/5 px-3 py-1.5 text-xs text-foreground/70"
              >
                <span>
                  <span className="font-mono text-foreground/50">{k}</span>
                  {': '}
                  <span className="font-mono">{v}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeParam(k)}
                  aria-label={`Remove parameter ${k}`}
                  className="ml-2 text-foreground/40 transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="flex items-center justify-center gap-2 rounded-xl bg-[color:var(--color-theme-primary)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-theme-primary)] focus-visible:ring-offset-2"
      >
        {isLoading && <Spinner label="Creating proposal…" />}
        Create proposal
      </button>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface MultiSigProps {
  /** Optional: override for tests / SSR. In production this is derived from the hook. */
  initialConnectedAddress?: string;
}

export function MultiSig({ initialConnectedAddress }: MultiSigProps) {
  const {
    walletAddress,
    isWalletConnected,
    isConnecting,
    connectWallet,
    txState,
    isLoading,
    lastError,
    errorMessage,
    displayState,
    canSign,
    propose,
    sign,
    execute,
    clearError,
    reset,
  } = useMultiSigWallet();

  // Access signer list from the store (separate selector to avoid over-rendering).
  const signerList = useMultiSigStore(
    (s): SignerStatus[] => (s.currentProposal ? s.getSignerStatuses() : []),
  );
  const currentProposal = useMultiSigStore((s) => s.currentProposal);
  const transactionHash = useMultiSigStore((s) => s.transactionHash);
  const confirmingAttempt = useMultiSigStore((s) => s.confirmingAttempt);

  // Connection error (outside multi-sig flow).
  const [connectError, setConnectError] = useState<string | null>(null);

  // Dismiss button receives focus whenever a new error appears.
  const dismissRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if ((errorMessage || connectError) && dismissRef.current) {
      dismissRef.current.focus();
    }
  }, [errorMessage, connectError]);

  const displayAddress = walletAddress ?? initialConnectedAddress ?? null;

  const {
    phase,
    totalSigners,
    signedCount,
    threshold,
    thresholdMet,
    isExpired,
  } = displayState;

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleConnect = useCallback(async () => {
    setConnectError(null);
    try {
      await connectWallet();
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : 'Failed to connect wallet.',
      );
    }
  }, [connectWallet]);

  const handlePropose = useCallback(
    async (params: ProposeParams) => {
      try {
        await propose(params);
      } catch {
        // Error is stored in the Zustand store; displayed via `errorMessage`.
      }
    },
    [propose],
  );

  const handleSign = useCallback(async () => {
    try {
      await sign();
    } catch {
      // Handled via store.
    }
  }, [sign]);

  const handleExecute = useCallback(async () => {
    try {
      await execute();
    } catch {
      // Handled via store.
    }
  }, [execute]);

  const handleDismissError = useCallback(() => {
    clearError();
    setConnectError(null);
  }, [clearError]);

  // ── Error code → display title ──────────────────────────────────────────

  const errorTitle = (() => {
    if (!lastError) return 'Transaction error';
    switch (lastError.code) {
      case 'USER_REJECTED':       return 'Signature declined';
      case 'CONFIRMATION_TIMEOUT': return 'Confirmation timed out';
      case 'NETWORK_MISMATCH':    return 'Network mismatch';
      case 'INSUFFICIENT_BALANCE': return 'Insufficient balance';
      case 'THRESHOLD_NOT_MET':   return 'Not enough signatures';
      case 'PROPOSAL_EXPIRED':    return 'Proposal expired';
      default:                    return 'Transaction error';
    }
  })();

  // ── Visible phase (normalise error → current step) ──────────────────────
  const visiblePhase: PhaseKey | 'idle' | 'error' =
    phase === 'error'
      ? (currentProposal ? 'sign' : 'propose')
      : phase;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section
      className="flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl"
      aria-label="Multi-signature transaction panel"
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Multi-Sig Transaction
        </h2>
        {(txState !== 'idle' || currentProposal !== null) && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-foreground/40 transition-colors hover:text-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-theme-primary)]"
            aria-label="Reset multi-sig flow and start over"
          >
            Reset
          </button>
        )}
      </header>

      {/* Phase indicator (only shown once a flow is active) */}
      {phase !== 'idle' && (
        <PhaseIndicator current={visiblePhase} />
      )}

      {/* ── Polite live region for screen readers ── */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {txState === 'building'   && 'Building transaction…'}
        {txState === 'simulating' && 'Simulating transaction on Soroban…'}
        {txState === 'proposed'   && 'Proposal created. Waiting for co-signers.'}
        {txState === 'signing'    && 'Waiting for Freighter signature…'}
        {txState === 'signed'     && 'Signature applied. Waiting for more signers.'}
        {txState === 'ready'      && 'All signatures collected. Ready to execute.'}
        {txState === 'submitting' && 'Submitting to the Stellar network…'}
        {txState === 'confirming' && `Confirming transaction, attempt ${confirmingAttempt ?? 1}…`}
        {txState === 'confirmed'  && 'Transaction confirmed!'}
        {txState === 'rejected'   && 'Signature was declined.'}
        {txState === 'timeout'    && 'Confirmation timed out.'}
        {txState === 'failed'     && 'Transaction failed.'}
      </div>

      {/* ── Error banner ── */}
      {(errorMessage || connectError) && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">{errorTitle}</span>
            <span className="text-xs text-red-300/80">
              {errorMessage ?? connectError}
            </span>
          </div>
          <button
            ref={dismissRef}
            type="button"
            onClick={handleDismissError}
            aria-label="Dismiss error"
            className="mt-0.5 shrink-0 text-red-300/60 transition-colors hover:text-red-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Not connected ── */}
      {!isWalletConnected && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <p className="text-sm text-foreground/60">
            Connect your Freighter wallet to create or sign multi-sig proposals.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting}
            aria-busy={isConnecting}
            className="flex items-center gap-2 rounded-xl bg-[color:var(--color-theme-primary)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-theme-primary)] focus-visible:ring-offset-2"
          >
            {isConnecting && <Spinner label="Connecting…" />}
            {isConnecting ? 'Connecting…' : 'Connect Freighter'}
          </button>
        </div>
      )}

      {/* ── Connected wallet badge ── */}
      {isWalletConnected && displayAddress && (
        <div
          className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-400"
          aria-label={`Connected wallet: ${displayAddress}`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
          <span className="font-mono">
            {displayAddress.slice(0, 8)}…{displayAddress.slice(-4)}
          </span>
          <span className="text-emerald-400/60">connected</span>
        </div>
      )}

      {/* ── Propose phase ── */}
      {isWalletConnected && currentProposal === null && phase !== 'done' && (
        <ProposeForm onSubmit={handlePropose} isLoading={isLoading} />
      )}

      {/* ── Sign phase ── */}
      {currentProposal !== null &&
        (phase === 'sign' || txState === 'proposed' || txState === 'signed') && (
          <div className="flex flex-col gap-4">
            {/* Signature progress */}
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground/80">Signatures</span>
              <span
                className={[
                  'font-mono text-xs tabular-nums',
                  thresholdMet ? 'text-emerald-400' : 'text-foreground/50',
                ].join(' ')}
                aria-label={`${signedCount} of ${threshold} required signatures collected`}
              >
                {signedCount}&thinsp;/&thinsp;{threshold} required
              </span>
            </div>

            <div
              role="progressbar"
              aria-valuenow={signedCount}
              aria-valuemin={0}
              aria-valuemax={threshold}
              aria-label="Signature collection progress"
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className={[
                  'h-full rounded-full transition-all duration-500',
                  thresholdMet
                    ? 'bg-emerald-500'
                    : 'bg-[color:var(--color-theme-primary)]',
                ].join(' ')}
                style={{
                  width: `${Math.min(
                    100,
                    (signedCount / Math.max(threshold, 1)) * 100,
                  )}%`,
                }}
              />
            </div>

            {/* Signer list */}
            {signerList.length > 0 && (
              <ul
                className="flex flex-col gap-1.5"
                aria-label={`${totalSigners} required signer${totalSigners !== 1 ? 's' : ''}`}
              >
                {signerList.map((signer) => (
                  <SignerRow key={signer.publicKey} signer={signer} />
                ))}
              </ul>
            )}

            {/* Expiry warning */}
            {isExpired && (
              <p
                role="alert"
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300"
              >
                This proposal has expired. Please reset and create a new one.
              </p>
            )}

            {/* Sign CTA */}
            {canSign && !isExpired && (
              <button
                type="button"
                onClick={handleSign}
                disabled={isLoading}
                aria-busy={isLoading && txState === 'signing'}
                className="flex items-center justify-center gap-2 rounded-xl bg-[color:var(--color-theme-primary)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-theme-primary)] focus-visible:ring-offset-2"
              >
                {isLoading && txState === 'signing' && (
                  <Spinner label="Signing with Freighter…" />
                )}
                Sign with Freighter
              </button>
            )}

            {/* Execute CTA (only when threshold met) */}
            {thresholdMet && !isExpired && (
              <button
                type="button"
                onClick={handleExecute}
                disabled={isLoading}
                aria-busy={
                  isLoading &&
                  (txState === 'submitting' || txState === 'confirming')
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                {isLoading &&
                  (txState === 'submitting' || txState === 'confirming') && (
                    <Spinner label="Submitting transaction…" />
                  )}
                Execute transaction
              </button>
            )}
          </div>
        )}

      {/* ── Execute / confirming spinner ── */}
      {(txState === 'submitting' ||
        txState === 'submitted' ||
        txState === 'confirming') && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Spinner label="Awaiting confirmation" />
          <p className="text-sm text-foreground/60">
            {txState === 'submitting' && 'Submitting to the Stellar network…'}
            {txState === 'submitted' && 'Awaiting ledger inclusion…'}
            {txState === 'confirming' &&
              `Confirming${confirmingAttempt !== null ? ` (attempt ${confirmingAttempt})` : ''}…`}
          </p>
        </div>
      )}

      {/* ── Confirmed ── */}
      {txState === 'confirmed' && (
        <div
          className="flex flex-col items-center gap-3 py-4 text-center"
          aria-live="polite"
        >
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"
            aria-hidden="true"
          >
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </span>
          <p className="font-semibold text-emerald-300">Transaction confirmed!</p>
          {transactionHash && (
            <p className="break-all font-mono text-[11px] text-foreground/40">
              {transactionHash}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-sm text-foreground/40 underline underline-offset-2 transition-colors hover:text-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-theme-primary)]"
          >
            Start a new proposal
          </button>
        </div>
      )}
    </section>
  );
}

export default MultiSig;
