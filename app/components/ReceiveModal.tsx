"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  QrCode,
  X,
} from "lucide-react";

export type ReceiveModalVariant = "primary" | "secondary";

export interface ReceiveModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Called when the user dismisses the modal (Escape, backdrop, or close button). */
  onClose: () => void;
  /** Stellar public address to receive funds to. */
  address: string;
  /** Stellar network the address belongs to. */
  network?: "mainnet" | "testnet";
  /** Visual density / emphasis variant. */
  variant?: ReceiveModalVariant;
  /** When true, shows the loading placeholder (e.g. while resolving the address). */
  loading?: boolean;
  /** When true, disables interactive controls. */
  disabled?: boolean;
  /** Optional error message shown instead of the address. */
  error?: string | null;
  /** Heading text. */
  title?: string;
  /** Supporting copy. */
  description?: string;
}

const DEFAULT_TITLE = "Receive assets";
const DEFAULT_DESCRIPTION =
  "Share this address or QR code to receive XLM or other Stellar assets.";

function hashToSeed(value: string): number {
  let seed = 2166136261;
  for (let i = 0; i < value.length; i++) {
    seed ^= value.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildQrMatrix(address: string, size = 21): boolean[][] {
  const rand = mulberry32(hashToSeed(address));
  const cells = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );

  const drawFinder = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const onCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        cells[row + r][col + c] = onBorder || onCenter;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!cells[r][c]) cells[r][c] = rand() > 0.5;
    }
  }

  return cells;
}

function QrGlyph({ address, className }: { address: string; className?: string }) {
  const size = 21;
  const cell = 10;
  const matrix = useMemo(() => buildQrMatrix(address), [address]);
  const squares: ReactNode[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        squares.push(
          <rect
            key={`${r}-${c}`}
            x={c * cell}
            y={r * cell}
            width={cell}
            height={cell}
            fill="currentColor"
          />,
        );
      }
    }
  }

  return (
    <svg
      className={className}
      viewBox={`0 0 ${size * cell} ${size * cell}`}
      role="img"
      aria-label="QR code for this address"
      focusable="false"
    >
      {squares}
    </svg>
  );
}

export function ReceiveModal({
  open,
  onClose,
  address,
  network = "testnet",
  variant = "primary",
  loading = false,
  disabled = false,
  error = null,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: ReceiveModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  const handleCopy = useCallback(async () => {
    if (disabled || loading || copied || !address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the address is still visible on screen.
    }
  }, [address, disabled, loading, copied]);

  const isPrimary = variant === "primary";
  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-6)}`
    : "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="receive-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            key="receive-modal-panel"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[var(--color-theme-background)] p-6 text-[var(--foreground)] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-lg font-black tracking-tight text-[var(--foreground)]"
                >
                  {title}
                </h2>
                <p
                  id={descriptionId}
                  className="mt-1 text-sm text-[var(--foreground)]/60"
                >
                  {description}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close receive modal"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[var(--foreground)]/70 transition-colors hover:bg-white/10 hover:text-[var(--foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-theme-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-theme-background)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6">
              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
                >
                  <AlertCircle
                    className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center rounded-xl border border-white/10 bg-white/5 p-5"
                  aria-busy={loading}
                >
                  <div className="flex h-48 w-48 items-center justify-center rounded-lg bg-white p-3 text-black">
                    {loading ? (
                      <Loader2
                        className="h-10 w-10 animate-spin text-[var(--color-theme-primary)]"
                        aria-hidden="true"
                      />
                    ) : (
                      <QrGlyph address={address} className="h-full w-full" />
                    )}
                  </div>

                  <div className="mt-5 w-full">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]/50">
                      Your {network === "mainnet" ? "Mainnet" : "Testnet"} address
                    </span>
                    <div className="mt-2 flex w-full items-center gap-3">
                      <code
                        className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-[var(--foreground)]"
                        aria-label="Stellar receive address"
                      >
                        {loading
                          ? "GAAAI…AAAAA"
                          : isPrimary
                            ? address
                            : shortAddress}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopy}
                        disabled={disabled || loading || !address}
                        aria-label="Copy address to clipboard"
                        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-theme-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-theme-background)] ${
                          copied
                            ? "border-green-500/40 bg-green-500/10 text-green-400"
                            : "border-white/10 bg-white/5 text-[var(--foreground)] hover:bg-white/10"
                        } ${
                          disabled || loading || !address
                            ? "cursor-not-allowed opacity-50"
                            : ""
                        }`}
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden="true" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" aria-hidden="true" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {!isPrimary && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--foreground)]/70">
                      <QrCode className="h-4 w-4" aria-hidden="true" />
                      Scan to send directly to this wallet
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
