"use client";

/**
 * ExportCsvSkeleton
 *
 * Shimmer-effect loading skeleton for the Export CSV page. Rendered while the
 * wallet connection state is being checked and/or while wrap data is being
 * fetched, preventing a blank-screen flash and avoiding layout shift (CLS).
 *
 * Design constraints
 * ──────────────────
 * - No inline styles.  All visual tokens use Tailwind + globals.css vars.
 * - No `any`.  All types are explicit.
 * - role="status" + sr-only text for screen-reader announcement.
 * - Dark / light theming via CSS custom properties.
 * - Dimensions mirror the real Export CSV page sections to avoid CLS.
 */

import React from "react";

// ─── Primitive skeleton blocks ─────────────────────────────────────────────────

interface ShimmerProps {
  className?: string;
}

/**
 * A single pulsing shimmer block.  Width / height / rounding are controlled
 * entirely by the caller through `className` so no inline styles are required.
 */
function Shimmer({ className = "" }: ShimmerProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/10 ${className}`}
      aria-hidden="true"
    />
  );
}

// ─── Section-level skeletons ───────────────────────────────────────────────────

/** Mirrors the "Wallet Connection" card on the real page. */
function WalletCardSkeleton() {
  return (
    <div
      className="mb-8 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-6"
      aria-hidden="true"
    >
      {/* Header row: title + network badge */}
      <div className="mb-4 flex items-center justify-between">
        <Shimmer className="h-4 w-36" />
        <Shimmer className="h-5 w-16 rounded-full" />
      </div>
      {/* Connection status placeholder */}
      <Shimmer className="h-11 w-full rounded-xl" />
    </div>
  );
}

/** Mirrors a single ExportButton on the real page. */
function ExportButtonSkeleton() {
  return (
    <div
      className="flex items-start gap-4 rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-4"
      aria-hidden="true"
    >
      {/* Icon placeholder */}
      <Shimmer className="mt-0.5 h-5 w-5 shrink-0 rounded-md" />
      <div className="flex-1 space-y-2">
        <Shimmer className="h-3.5 w-1/3" />
        <Shimmer className="h-2.5 w-2/3" />
      </div>
    </div>
  );
}

/** Mirrors the "Export Options" section that appears after wallet connect. */
function ExportOptionsSkeleton() {
  return (
    <div className="mb-6" aria-hidden="true">
      {/* Section heading */}
      <Shimmer className="mb-4 h-4 w-28" />
      <div className="flex flex-col gap-3">
        <ExportButtonSkeleton />
        <ExportButtonSkeleton />
        <ExportButtonSkeleton />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export interface ExportCsvSkeletonProps {
  /** When true the export-options skeleton is also shown (wallet already connected). */
  showExportOptions?: boolean;
  /** Optional extra class names on the root element. */
  className?: string;
}

export function ExportCsvSkeleton({
  showExportOptions = false,
  className = "",
}: ExportCsvSkeletonProps) {
  return (
    <div
      className={`min-h-screen bg-[var(--background)] text-[var(--foreground)] ${className}`}
      aria-label="Loading Export CSV"
    >
      {/* sr-only live-region so assistive tech announces the loading state */}
      <p className="sr-only" role="status" aria-live="polite">
        Loading export options…
      </p>

      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Page header */}
        <div className="mb-10 space-y-2" aria-hidden="true">
          <Shimmer className="h-8 w-40" />
          <Shimmer className="h-3.5 w-full max-w-md" />
          <Shimmer className="h-3.5 w-3/4 max-w-sm" />
        </div>

        {/* ProgressIndicator placeholder */}
        <div className="mb-8" aria-hidden="true">
          <Shimmer className="h-10 w-full rounded-xl" />
        </div>

        {/* Wallet connection card */}
        <WalletCardSkeleton />

        {/* Export options — only shown when wallet is already connected */}
        {showExportOptions && <ExportOptionsSkeleton />}
      </div>
    </div>
  );
}

export default ExportCsvSkeleton;
