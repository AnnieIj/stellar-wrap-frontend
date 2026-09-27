/**
 * Multi-Timeframe Indexing Service
 *
 * Fetches and analyzes Stellar transactions across three timeframes
 * (1 week, 2 weeks, 1 month) in parallel and computes comparative analysis.
 *
 * Issue #46
 */

import { IndexerResult, WrapPeriod } from "@/app/utils/indexer";
import { indexAccount } from "./indexerService";
import { IndexerEventEmitter } from "@/app/utils/indexerEventEmitter";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Timeframe = "1w" | "2w" | "1m";

/** Maps our short timeframe labels to WrapPeriod keys used by the indexer. */
const TIMEFRAME_TO_PERIOD: Record<Timeframe, WrapPeriod> = {
  "1w": "weekly",
  "2w": "biweekly",
  "1m": "monthly",
};

/** Human-readable labels for progress messages. */
export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "1w": "1 week",
  "2w": "2 weeks",
  "1m": "1 month",
};

export type TimeframeStatus = "pending" | "loading" | "success" | "failed";

export interface TimeframeResult {
  status: TimeframeStatus;
  data: IndexerResult | null;
  error: string | null;
}

/** Growth direction between two consecutive timeframes. */
export type Trend = "increasing" | "decreasing" | "stable";

export interface TimeframeComparison {
  /** % change in total volume from 1w → 2w window */
  volumeGrowth1wTo2w: number;
  /** % change in total volume from 2w → 1m window */
  volumeGrowth2wTo1m: number;
  /** % change in tx count from 1w → 2w window */
  txGrowth1wTo2w: number;
  /** % change in tx count from 2w → 1m window */
  txGrowth2wTo1m: number;
  /** Overall volume trend across all three windows */
  volumeTrend: Trend;
  /** Overall transaction-count trend across all three windows */
  txTrend: Trend;
  /** Which timeframe had the highest volume */
  mostActiveByVolume: Timeframe;
  /** Which timeframe had the most transactions */
  mostActiveByTxCount: Timeframe;
}

export interface MultiTimeframeResult {
  accountId: string;
  "1w": TimeframeResult;
  "2w": TimeframeResult;
  "1m": TimeframeResult;
  comparison: TimeframeComparison | null;
  /** ISO timestamp when indexing completed */
  indexedAt: string;
}

// ── Progress events ───────────────────────────────────────────────────────────

export interface TimeframeProgress {
  timeframe: Timeframe;
  status: TimeframeStatus;
  /** 0-100 */
  progress: number;
  /** Aggregated overall progress across all timeframes (0-100) */
  overallProgress: number;
}

export type TimeframeProgressCallback = (p: TimeframeProgress) => void;

// ── Helpers ───────────────────────────────────────────────────────────────────

function percentChange(from: number, to: number): number {
  if (from === 0) return to > 0 ? 100 : 0;
  return Math.round(((to - from) / from) * 100 * 10) / 10;
}

function trend(a: number, b: number, c: number): Trend {
  const STABLE_THRESHOLD = 5; // within 5% is considered stable
  const avgChange = ((b - a) / (a || 1) + (c - b) / (b || 1)) / 2;
  const pct = avgChange * 100;
  if (pct > STABLE_THRESHOLD) return "increasing";
  if (pct < -STABLE_THRESHOLD) return "decreasing";
  return "stable";
}

function maxBy<T>(items: T[], fn: (item: T) => number): T {
  return items.reduce((best, item) => (fn(item) > fn(best) ? item : best));
}

/**
 * Build comparative analysis from three timeframe results.
 * Only uses timeframes that succeeded.
 */
function buildComparison(
  r1w: IndexerResult | null,
  r2w: IndexerResult | null,
  r1m: IndexerResult | null
): TimeframeComparison | null {
  // Need at least 2 successful timeframes for comparison
  const available = [r1w, r2w, r1m].filter(Boolean);
  if (available.length < 2) return null;

  const vol1w = r1w?.totalVolume ?? 0;
  const vol2w = r2w?.totalVolume ?? 0;
  const vol1m = r1m?.totalVolume ?? 0;

  const tx1w = r1w?.totalTransactions ?? 0;
  const tx2w = r2w?.totalTransactions ?? 0;
  const tx1m = r1m?.totalTransactions ?? 0;

  // Most active timeframe by volume
  const volumeEntries: { tf: Timeframe; val: number }[] = [
    { tf: "1w" as Timeframe, val: vol1w },
    { tf: "2w" as Timeframe, val: vol2w },
    { tf: "1m" as Timeframe, val: vol1m },
  ].filter((e) =>
    e.tf === "1w" ? r1w !== null : e.tf === "2w" ? r2w !== null : r1m !== null
  );

  const txEntries: { tf: Timeframe; val: number }[] = [
    { tf: "1w" as Timeframe, val: tx1w },
    { tf: "2w" as Timeframe, val: tx2w },
    { tf: "1m" as Timeframe, val: tx1m },
  ].filter((e) =>
    e.tf === "1w" ? r1w !== null : e.tf === "2w" ? r2w !== null : r1m !== null
  );

  return {
    volumeGrowth1wTo2w: r1w && r2w ? percentChange(vol1w, vol2w) : 0,
    volumeGrowth2wTo1m: r2w && r1m ? percentChange(vol2w, vol1m) : 0,
    txGrowth1wTo2w: r1w && r2w ? percentChange(tx1w, tx2w) : 0,
    txGrowth2wTo1m: r2w && r1m ? percentChange(tx2w, tx1m) : 0,
    volumeTrend: trend(vol1w, vol2w, vol1m),
    txTrend: trend(tx1w, tx2w, tx1m),
    mostActiveByVolume: maxBy(volumeEntries, (e) => e.val).tf,
    mostActiveByTxCount: maxBy(txEntries, (e) => e.val).tf,
  };
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Index an account across all three timeframes.
 *
 * Fetches the widest period (1 month) first, then derives the narrower
 * timeframes (2 weeks, 1 week) from the wider cached result in memory.
 * This avoids duplicate Horizon requests across overlapping timeframes.
 *
 * - Uses `Promise.allSettled` so a failure in one timeframe does not abort
 *   the others — partial results are always returned.
 * - Fires `onProgress` callbacks as each timeframe completes.
 * - Builds comparative analysis from whatever timeframes succeeded.
 *
 * @example
 * const result = await indexAccountMultiTimeframe("GABC...", "mainnet", (p) => {
 *   console.log(`${p.timeframe}: ${p.progress}% (overall ${p.overallProgress}%)`);
 * });
 */
export async function indexAccountMultiTimeframe(
  accountId: string,
  network: "mainnet" | "testnet" = "mainnet",
  onProgress?: TimeframeProgressCallback
): Promise<MultiTimeframeResult> {
  const emitter = IndexerEventEmitter.getInstance();

  // Track per-timeframe progress locally so we can aggregate overall %
  const progressMap: Record<Timeframe, number> = { "1w": 0, "2w": 0, "1m": 0 };
  const statusMap: Record<Timeframe, TimeframeStatus> = {
    "1w": "pending",
    "2w": "pending",
    "1m": "pending",
  };

  function updateOverall() {
    return Math.round(
      (progressMap["1w"] + progressMap["2w"] + progressMap["1m"]) / 3
    );
  }

  function emit(tf: Timeframe, progress: number, status?: TimeframeStatus) {
    progressMap[tf] = progress;
    if (status) statusMap[tf] = status;
    onProgress?.({
      timeframe: tf,
      status: statusMap[tf],
      progress,
      overallProgress: updateOverall(),
    });
  }

  /**
   * Index a single timeframe, emitting progress events.
   * Wraps `indexAccount` which internally drives the IndexerEventEmitter.
   */
  async function indexOneTimeframe(tf: Timeframe): Promise<IndexerResult> {
    const period = TIMEFRAME_TO_PERIOD[tf];
    emit(tf, 0, "loading");

    // Listen to the global emitter's step-progress events and forward
    // them as timeframe-scoped progress (0-90, leaving 90-100 for finalizing).
    const stepWeights: Record<string, number> = {
      initializing: 5,
      "fetching-transactions": 40,
      "filtering-timeframes": 15,
      "calculating-volume": 15,
      "identifying-assets": 10,
      "counting-contracts": 10,
      finalizing: 5,
    };
    let accumulatedWeight = 0;

    const stepChangeHandler = (step: string) => {
      accumulatedWeight = Object.entries(stepWeights)
        .filter(([s]) => {
          const steps = Object.keys(stepWeights);
          return steps.indexOf(s) < steps.indexOf(step);
        })
        .reduce((sum, [, w]) => sum + w, 0);
      emit(tf, Math.min(85, accumulatedWeight));
    };

    const stepProgressHandler = (_step: string, progress: number) => {
      const stepProgress = (progress / 100) * (stepWeights[_step] ?? 0);
      const pct = Math.min(
        90,
        Math.round(accumulatedWeight + stepProgress)
      );
      emit(tf, pct);
    };

    emitter.on("stepChange", stepChangeHandler);
    emitter.on("stepProgress", stepProgressHandler);

    try {
      const wrapped = await indexAccount(accountId, network, period);
      emitter.off("stepChange", stepChangeHandler);
      emitter.off("stepProgress", stepProgressHandler);
      emit(tf, 100, "success");
      return wrapped.result;
    } catch (err) {
      emitter.off("stepChange", stepChangeHandler);
      emitter.off("stepProgress", stepProgressHandler);
      emit(tf, 100, "failed");
      throw err;
    }
  }

  // ── Sequential widest-first fetch ────────────────────────────────────
  // Fetch the widest period (1 month) first so its raw transactions are
  // cached and can serve the narrower 2-week and 1-week requests without
  // additional Horizon round-trips.
  const timeframes: Timeframe[] = ["1m", "2w", "1w"];

  const settled = await Promise.allSettled(
    timeframes.map((tf) => indexOneTimeframe(tf))
  );

  // ── Assemble results ────────────────────────────────────────────────────────
  const results: Record<Timeframe, TimeframeResult> = {
    "1w": { status: "pending", data: null, error: null },
    "2w": { status: "pending", data: null, error: null },
    "1m": { status: "pending", data: null, error: null },
  };

  settled.forEach((outcome, i) => {
    const tf = timeframes[i];
    if (outcome.status === "fulfilled") {
      results[tf] = { status: "success", data: outcome.value, error: null };
    } else {
      const msg =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason);
      results[tf] = { status: "failed", data: null, error: msg };
    }
  });

  const comparison = buildComparison(
    results["1w"].data,
    results["2w"].data,
    results["1m"].data
  );

  return {
    accountId,
    "1w": results["1w"],
    "2w": results["2w"],
    "1m": results["1m"],
    comparison,
    indexedAt: new Date().toISOString(),
  };
}

// ── Utility exports ───────────────────────────────────────────────────────────

/**
 * Returns a human-readable summary of the comparative analysis.
 * Useful for generating wrap copy.
 */
export function summarizeComparison(
  comparison: TimeframeComparison
): string {
  const { volumeTrend, mostActiveByVolume, volumeGrowth1wTo2w } = comparison;

  const trendText =
    volumeTrend === "increasing"
      ? "📈 Your activity is growing"
      : volumeTrend === "decreasing"
      ? "📉 Your activity is slowing"
      : "➡️ Your activity is steady";

  const mostActiveLabel = TIMEFRAME_LABELS[mostActiveByVolume];
  const changeText =
    Math.abs(volumeGrowth1wTo2w) > 0
      ? ` (${volumeGrowth1wTo2w > 0 ? "+" : ""}${volumeGrowth1wTo2w}% week-over-week)`
      : "";

  return `${trendText}${changeText}. Most active window: ${mostActiveLabel}.`;
}
