"use client";

/**
 * MultiTimeframeStats
 *
 * Displays the indexing progress and results for all three timeframes
 * (1w, 2w, 1m) plus the comparative analysis summary.
 *
 * Issue #46
 */

import React, { lazy, Suspense } from "react";
import {
  useMultiTimeframeStore,
  selectIsComplete,
  selectFailedTimeframes,
} from "@/app/store/multiTimeframeStore";
import { TIMEFRAME_LABELS, Timeframe } from "@/app/services/multiTimeframeIndexer";
import { useWrapStore } from "@/app/store/wrapStore";

const WeeklyComparisonChart = lazy(() =>
  import("@/app/components/WeeklyComparisonChart").then((m) => ({
    default: m.WeeklyComparisonChart,
  })),
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M XLM`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K XLM`;
  return `${v.toFixed(2)} XLM`;
}

function trendIcon(trend: string): string {
  if (trend === "increasing") return "📈";
  if (trend === "decreasing") return "📉";
  return "➡️";
}

function changeLabel(pct: number): string {
  if (pct === 0) return "—";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TimeframeCard({ tf }: { tf: Timeframe }) {
  const status = useMultiTimeframeStore((s) => s.statuses[tf]);
  const progress = useMultiTimeframeStore((s) => s.progress[tf]);
  const data = useMultiTimeframeStore((s) => s.results[tf].data);
  const error = useMultiTimeframeStore((s) => s.results[tf].error);
  const accountId = useMultiTimeframeStore((s) => s.accountId);
  const retryTimeframe = useMultiTimeframeStore((s) => s.retryTimeframe);

  const label = TIMEFRAME_LABELS[tf];

  const statusColors: Record<string, string> = {
    pending: "border-white/10 bg-slate-900/40",
    loading: "border-blue-500/30 bg-blue-500/5",
    success: "border-emerald-500/30 bg-emerald-500/5",
    failed: "border-red-500/30 bg-red-500/5",
  };

  return (
    <div
      className={`rounded-2xl border p-4 transition-all ${statusColors[status] ?? statusColors.pending}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">{label}</span>
        {status === "loading" && (
          <span className="text-xs text-blue-400 animate-pulse">Indexing…</span>
        )}
        {status === "success" && (
          <span className="text-xs text-emerald-400">✓ Done</span>
        )}
        {status === "failed" && (
          <span className="text-xs text-red-400">✗ Failed</span>
        )}
        {status === "pending" && (
          <span className="text-xs text-gray-500">Waiting</span>
        )}
      </div>

      {/* Progress bar */}
      {(status === "loading" || status === "pending") && (
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Data */}
      {status === "success" && data && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Transactions</span>
            <span className="text-white font-medium tabular-nums">
              {data.totalTransactions.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Volume</span>
            <span className="text-white font-medium tabular-nums">
              {formatVolume(data.totalVolume)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Contracts</span>
            <span className="text-white font-medium tabular-nums">
              {data.contractCalls.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Top asset</span>
            <span className="text-white font-medium">{data.mostActiveAsset}</span>
          </div>
        </div>
      )}

      {/* Error + retry */}
      {status === "failed" && (
        <div className="space-y-2">
          <p className="text-xs text-red-400 break-words">{error ?? "Unknown error"}</p>
          {accountId && (
            <button
              onClick={() => retryTimeframe(tf, accountId, "mainnet")}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonPanel() {
  const comparison = useMultiTimeframeStore((s) => s.comparison);
  if (!comparison) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        {trendIcon(comparison.volumeTrend)} Comparative Analysis
      </h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-gray-400 mb-1">Volume trend</p>
          <p className="text-sm font-semibold text-white capitalize">
            {trendIcon(comparison.volumeTrend)} {comparison.volumeTrend}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-gray-400 mb-1">TX trend</p>
          <p className="text-sm font-semibold text-white capitalize">
            {trendIcon(comparison.txTrend)} {comparison.txTrend}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-gray-400 mb-1">Most active (volume)</p>
          <p className="text-sm font-semibold text-white">
            {TIMEFRAME_LABELS[comparison.mostActiveByVolume]}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-gray-400 mb-1">Most active (TXs)</p>
          <p className="text-sm font-semibold text-white">
            {TIMEFRAME_LABELS[comparison.mostActiveByTxCount]}
          </p>
        </div>
      </div>

      {/* Growth table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500">
            <th className="text-left pb-2">Period</th>
            <th className="text-right pb-2">Volume Δ</th>
            <th className="text-right pb-2">TX Δ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          <tr>
            <td className="py-1.5 text-gray-300">1w → 2w</td>
            <td
              className={`text-right tabular-nums ${comparison.volumeGrowth1wTo2w >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {changeLabel(comparison.volumeGrowth1wTo2w)}
            </td>
            <td
              className={`text-right tabular-nums ${comparison.txGrowth1wTo2w >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {changeLabel(comparison.txGrowth1wTo2w)}
            </td>
          </tr>
          <tr>
            <td className="py-1.5 text-gray-300">2w → 1m</td>
            <td
              className={`text-right tabular-nums ${comparison.volumeGrowth2wTo1m >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {changeLabel(comparison.volumeGrowth2wTo1m)}
            </td>
            <td
              className={`text-right tabular-nums ${comparison.txGrowth2wTo1m >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {changeLabel(comparison.txGrowth2wTo1m)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MultiTimeframeStats() {
  const isLoading = useMultiTimeframeStore((s) => s.isLoading);
  const overallProgress = useMultiTimeframeStore((s) => s.overallProgress);
  const isComplete = useMultiTimeframeStore(selectIsComplete);
  const failedTimeframes = useMultiTimeframeStore(selectFailedTimeframes);
  const error = useMultiTimeframeStore((s) => s.error);
  const results = useMultiTimeframeStore((s) => s.results);
  const period = useWrapStore((s) => s.period);

  const timeframes: Timeframe[] = ["1w", "2w", "1m"];

  const showChart =
    (period === "monthly" || period === "yearly") &&
    isComplete &&
    results["1w"].data !== null &&
    results["2w"].data !== null &&
    results["1m"].data !== null;

  return (
    <div className="space-y-4">
      {/* Overall progress bar */}
      {isLoading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Indexing all timeframes…</span>
            <span className="text-white tabular-nums">{overallProgress}%</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Partial failure banner */}
      {isComplete && failedTimeframes.length > 0 && failedTimeframes.length < 3 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
          ⚠️ Some timeframes failed to load:{" "}
          {failedTimeframes.map((tf) => TIMEFRAME_LABELS[tf]).join(", ")}.
          Results are partial.
        </div>
      )}

      {/* Full failure banner */}
      {isComplete && failedTimeframes.length === 3 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
          ✗ All timeframes failed to index. {error}
        </div>
      )}

      {/* Timeframe cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {timeframes.map((tf) => (
          <TimeframeCard key={tf} tf={tf} />
        ))}
      </div>

      {/* Comparison panel — only shown when at least 2 succeeded */}
      {isComplete && <ComparisonPanel />}

      {/* Weekly comparison chart — monthly and yearly periods */}
      {showChart && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            {period === "yearly"
              ? "📊 Recent Activity (last 4 weeks of your 2026 year)"
              : "📊 Weekly Activity (current week vs last 4 weeks)"}
          </h3>
          <Suspense
            fallback={
              <div className="h-32 rounded-xl bg-white/5 animate-pulse" aria-hidden="true" />
            }
          >
            <WeeklyComparisonChart
              tx1w={results["1w"].data!.totalTransactions}
              tx2w={results["2w"].data!.totalTransactions}
              tx1m={results["1m"].data!.totalTransactions}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
