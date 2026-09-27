import { memo } from "react";
import { RecentLedger } from "@/src/services/horizonIndexer";

function formatClosedAt(closedAt: string): string {
  const date = new Date(closedAt);
  if (Number.isNaN(date.getTime())) {
    return closedAt;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

export interface LedgerRowProps {
  ledger: RecentLedger;
}

/**
 * `memo`-wrapped and given only a single primitive-bearing prop so a
 * parent re-render — e.g. the refresh spinner toggling — does not re-render
 * every row whose underlying ledger data hasn't changed.
 */
function LedgerRowComponent({ ledger }: LedgerRowProps) {
  const hasFailures = ledger.failedTransactionCount > 0;

  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-sm font-bold text-[var(--color-theme-primary)]">
          #{ledger.sequence}
        </span>
        <span className="text-xs text-white/50">{formatClosedAt(ledger.closedAt)}</span>
      </div>
      <div className="flex items-center gap-3 text-right">
        <div className="flex flex-col items-end">
          <span className="text-sm font-semibold text-white">
            {ledger.successfulTransactionCount}
          </span>
          <span className="text-xs text-white/50">txns</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-sm font-semibold text-white">{ledger.operationCount}</span>
          <span className="text-xs text-white/50">ops</span>
        </div>
        {hasFailures && (
          <span
            className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-bold text-red-400"
            title={`${ledger.failedTransactionCount} failed transaction(s)`}
          >
            {ledger.failedTransactionCount} failed
          </span>
        )}
      </div>
    </li>
  );
}

export const LedgerRow = memo(LedgerRowComponent);
