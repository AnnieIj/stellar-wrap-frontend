/**
 * CSV Export Utilities
 *
 * Helpers for formatting Stellar on-chain data and triggering browser
 * CSV file downloads.
 *
 * Amount precision:
 *   Stellar uses 7 decimal places (1 XLM = 10,000,000 stroops).
 *   `formatStroopsToXLM` converts a stroop integer to a human-readable
 *   XLM string with 7 decimal places.
 *   Where amounts are already in XLM (as stored in WrapResult), the
 *   `formatXlmAmount` helper applies the same 7-decimal precision.
 */

import type { WrapResult } from "@/app/store/wrapStore";

// ─── Amount formatting ────────────────────────────────────────────────────────

/** Number of stroops per XLM. */
export const STROOPS_PER_XLM = 10_000_000;

/**
 * Convert an integer stroop amount to an XLM string with 7 decimal places.
 *
 * @example formatStroopsToXLM(12_345_678) → "1.2345678"
 */
export function formatStroopsToXLM(stroops: number): string {
  if (!Number.isFinite(stroops) || stroops < 0) return "0.0000000";
  const xlm = stroops / STROOPS_PER_XLM;
  return xlm.toFixed(7);
}

/**
 * Format an XLM float amount to 7 decimal places.
 *
 * Use this when the value is already in XLM (not stroops).
 *
 * @example formatXlmAmount(1.234567891) → "1.2345679"
 */
export function formatXlmAmount(xlm: number): string {
  if (!Number.isFinite(xlm) || xlm < 0) return "0.0000000";
  return xlm.toFixed(7);
}

// ─── CSV row builders ─────────────────────────────────────────────────────────

/**
 * Build CSV rows for the wrap transaction summary.
 * Returns a 2D string array where [0] is the header row.
 */
export function buildTransactionCsvRows(result: WrapResult): string[][] {
  const header = [
    "Metric",
    "Value",
    "Unit",
  ];

  const rows: string[][] = [
    header,
    ["Total Transactions", String(result.totalTransactions), "count"],
    [
      "Network Percentile",
      `${result.percentile}`,
      "% (higher is more active)",
    ],
    ["Persona", result.persona, "archetype"],
  ];

  if (result.largestTransaction) {
    rows.push([
      "Largest Transaction",
      formatXlmAmount(result.largestTransaction.amount),
      result.largestTransaction.assetCode,
    ]);
  }

  if (result.dexTradingSummary) {
    const dex = result.dexTradingSummary;
    rows.push(
      [
        "DEX Trades",
        String("tradeCount" in dex ? (dex as { tradeCount: number }).tradeCount : 0),
        "count",
      ],
    );
  }

  return rows;
}

/**
 * Build CSV rows for the dApp interaction summary.
 * Returns a 2D string array where [0] is the header row.
 */
export function buildDappCsvRows(result: WrapResult): string[][] {
  const header = ["DApp Name", "Interactions", "Is Fan Favorite"];
  const rows: string[][] = [header];

  for (const dapp of result.dapps) {
    rows.push([
      dapp.name,
      String(dapp.interactions),
      dapp.isFanFavorite ? "Yes" : "No",
    ]);
  }

  return rows;
}

/**
 * Build CSV rows for the vibe summary.
 * Returns a 2D string array where [0] is the header row.
 */
export function buildVibeCsvRows(result: WrapResult): string[][] {
  const header = ["Vibe", "Percentage (%)", "Label"];
  const rows: string[][] = [header];

  for (const vibe of result.vibes) {
    rows.push([vibe.type, String(vibe.percentage), vibe.label]);
  }

  return rows;
}

// ─── CSV serialiser ───────────────────────────────────────────────────────────

/**
 * Escape a single CSV cell value.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 */
function escapeCell(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value);
  if (!needsQuotes) return value;
  // Double up any embedded double-quotes
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Convert a 2D string array to a CSV string.
 */
export function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\n");
}

// ─── Browser download trigger ─────────────────────────────────────────────────

/**
 * Trigger a browser CSV file download.
 *
 * Safe to call in a browser environment only (no-ops on server).
 *
 * @param filename  Desired file name, e.g. "wrap-transactions.csv"
 * @param rows      2D string array (first row is headers)
 */
export function exportToCsv(filename: string, rows: string[][]): void {
  if (typeof window === "undefined") return;

  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
