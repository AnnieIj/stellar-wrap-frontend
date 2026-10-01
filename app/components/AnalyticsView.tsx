"use client";

/**
 * AnalyticsView
 *
 * Displays a summary of the user's on-chain analytics — key stats, vibe
 * distribution, and dApp breakdown — in a fully responsive layout that
 * adapts cleanly from mobile (< 768 px) through tablet to desktop.
 *
 * Design constraints
 * ──────────────────
 * - No inline styles: all visual tokens live in globals.css / Tailwind.
 * - No `any`: all types are explicit.
 * - Every interactive element carries an aria-label.
 * - Shimmer skeleton is shown while `loading` is true to prevent CLS.
 * - Dark / light theming via CSS custom properties (--color-theme-primary etc.).
 */

import React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart2,
  Layers,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { WrapResult } from "@/app/store/wrapStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsViewProps {
  /** Wrap result data from the store. Null while loading or unavailable. */
  result: WrapResult | null;
  /** When true, the shimmer skeleton is rendered instead of data. */
  loading?: boolean;
  /** Optional extra class names for the root element. */
  className?: string;
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/10 ${className}`}
      aria-hidden="true"
    />
  );
}

function StatCardSkeleton() {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3"
      role="presentation"
      aria-hidden="true"
    >
      <SkeletonBlock className="h-3 w-1/2" />
      <SkeletonBlock className="h-7 w-3/4" />
      <SkeletonBlock className="h-2 w-full" />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
}

function MetricCard({ label, value, icon, description }: MetricCardProps) {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-[var(--color-theme-primary)]/40 focus-within:ring-2 focus-within:ring-[var(--color-theme-primary)] focus-within:ring-offset-2 focus-within:ring-offset-black"
      role="group"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[var(--color-theme-primary)]" aria-hidden="true">
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
          {label}
        </span>
      </div>
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-white/40">{description}</p>
      )}
    </div>
  );
}

interface VibeBarProps {
  label: string;
  percentage: number;
  color: string;
}

function VibeBar({ label, percentage, color }: VibeBarProps) {
  const clamped = Math.min(100, Math.max(0, percentage));
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-white/80 truncate max-w-[70%]">
          {label}
        </span>
        <span className="text-white/50 tabular-nums">{clamped}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} ${clamped}%`}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnalyticsView({
  result,
  loading = false,
  className = "",
}: AnalyticsViewProps) {
  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <section
        className={`space-y-8 ${className}`}
        aria-label="Analytics loading"
        aria-busy="true"
      >
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Loading key metrics"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
            <SkeletonBlock className="h-4 w-1/3" />
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-8 w-full" />
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
            <SkeletonBlock className="h-4 w-1/3" />
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        <span className="sr-only">Loading analytics data…</span>
      </section>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!result) {
    return (
      <section
        className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 px-4 text-center ${className}`}
        aria-label="No analytics data"
      >
        <BarChart2
          className="mb-4 h-12 w-12 text-white/20"
          aria-hidden="true"
        />
        <p className="text-base font-semibold text-white/60">
          No analytics data yet
        </p>
        <p className="mt-1 text-sm text-white/30">
          Complete the wrap flow to see your on-chain analytics.
        </p>
      </section>
    );
  }

  // ── Derived metrics ───────────────────────────────────────────────────────
  // WrapResult does not carry a totalVolume field; derive a display value from
  // DEX trading summary when available, or omit the volume card.
  const rawVolume = result.dexTradingSummary?.totalVolume ?? null;
  const volumeDisplay: string | null =
    rawVolume === null
      ? null
      : rawVolume >= 1_000_000
        ? `${(rawVolume / 1_000_000).toFixed(2)}M XLM`
        : rawVolume >= 1_000
          ? `${(rawVolume / 1_000).toFixed(1)}K XLM`
          : `${rawVolume.toFixed(2)} XLM`;

  const topVibe = [...(result.vibes ?? [])].sort(
    (a, b) => b.percentage - a.percentage,
  )[0];

  // DappData uses `interactions` (store field), not `transactions` (API field)
  const topDapp = [...(result.dapps ?? [])].sort(
    (a, b) => (b.interactions ?? 0) - (a.interactions ?? 0),
  )[0];

  return (
    <section
      className={`space-y-8 ${className}`}
      aria-label="On-chain analytics"
    >
      {/* ── Key metrics row ────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Key metrics"
      >
        <MetricCard
          label="Transactions"
          value={result.totalTransactions.toLocaleString()}
          icon={<Activity className="h-4 w-4" aria-hidden="true" />}
          description="Total on-chain transactions this period"
        />
        {volumeDisplay && (
          <MetricCard
            label="DEX Volume"
            value={volumeDisplay}
            icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
            description="Aggregate XLM moved via DEX"
          />
        )}
        <MetricCard
          label="Percentile"
          value={`${result.percentile}th`}
          icon={<Zap className="h-4 w-4" aria-hidden="true" />}
          description="Activity vs. other Stellar users"
        />
        <MetricCard
          label="dApps Used"
          value={result.dapps?.length ?? 0}
          icon={<Layers className="h-4 w-4" aria-hidden="true" />}
          description="Unique dApp interactions"
        />
      </div>

      {/* ── Vibes + dApps grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Vibe breakdown */}
        <div
          className="rounded-2xl border border-white/10 bg-white/5 p-5"
          aria-label="Vibe breakdown"
        >
          <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-white/50">
            Vibe Breakdown
          </h3>
          {result.vibes && result.vibes.length > 0 ? (
            <ul className="space-y-3" aria-label="Vibe percentages">
              {result.vibes.map((vibe) => (
                <VibeBar
                  key={vibe.type}
                  label={vibe.label ?? vibe.type}
                  percentage={vibe.percentage}
                  color={vibe.color}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/30">No vibe data available.</p>
          )}

          {topVibe && (
            <p className="mt-4 text-xs text-white/40">
              Top vibe:{" "}
              <span className="font-semibold text-white/70">
                {topVibe.label ?? topVibe.type}
              </span>
            </p>
          )}
        </div>

        {/* Top dApps */}
        <div
          className="rounded-2xl border border-white/10 bg-white/5 p-5"
          aria-label="Top dApps"
        >
          <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-white/50">
            Top dApps
          </h3>
          {result.dapps && result.dapps.length > 0 ? (
            <ol className="space-y-3" aria-label="dApp interaction counts">
              {result.dapps.slice(0, 5).map((dapp, idx) => (
                <li
                  key={dapp.name}
                  className="flex items-center gap-3"
                  aria-label={`${idx + 1}. ${dapp.name}: ${dapp.interactions ?? 0} interactions`}
                >
                  {/* Colour chip */}
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: dapp.gradient ?? dapp.color }}
                    aria-hidden="true"
                  />
                  {/* Name */}
                  <span className="flex-1 truncate text-sm font-medium text-white/80">
                    {dapp.name}
                  </span>
                  {/* Count */}
                  <span className="tabular-nums text-sm font-semibold text-white/50">
                    {(dapp.interactions ?? 0).toLocaleString()}
                  </span>
                  {/* Mini bar */}
                  <div
                    className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/10"
                    role="presentation"
                    aria-hidden="true"
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: dapp.gradient ?? dapp.color }}
                      initial={{ width: 0 }}
                      animate={{
                        width: `${
                          topDapp && topDapp.interactions
                            ? ((dapp.interactions ?? 0) /
                                topDapp.interactions) *
                              100
                            : 0
                        }%`,
                      }}
                      transition={{ duration: 0.5, ease: "easeOut", delay: idx * 0.05 }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-white/30">No dApp data available.</p>
          )}
        </div>
      </div>

      {/* ── Persona banner ─────────────────────────────────────────────────── */}
      {result.persona && (
        <div
          className="rounded-2xl border border-[var(--color-theme-primary)]/30 bg-[var(--color-theme-primary)]/5 px-5 py-4 sm:flex sm:items-center sm:gap-4"
          aria-label={`Your persona: ${result.persona}`}
        >
          <span
            className="mb-2 block text-3xl sm:mb-0"
            aria-hidden="true"
          >
            🎭
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-theme-primary)]">
              Your Persona
            </p>
            <p className="mt-0.5 text-lg font-black text-white">
              {result.persona}
            </p>
            {result.personaDescription && (
              <p className="mt-1 text-sm text-white/50">
                {result.personaDescription}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default AnalyticsView;
