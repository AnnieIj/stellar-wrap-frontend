"use client";

import { useRouter } from "next/navigation";
import { Inbox, RefreshCw, Globe2, CalendarRange } from "lucide-react";
import { useWrapStore, type WrapPeriod } from "@/app/store/wrapStore";

interface ZeroActivityEmptyStateProps {
  /** Optional override for the selected period label */
  periodLabel?: string;
  className?: string;
}

const PERIOD_LABELS: Record<WrapPeriod, string> = {
  weekly: "past week",
  monthly: "past month",
  yearly: "past year",
};

export function ZeroActivityEmptyState({
  periodLabel,
  className = "",
}: ZeroActivityEmptyStateProps) {
  const router = useRouter();
  const { period, network, setPeriod, setNetwork, setResult, setStatus, reset } = useWrapStore();

  const label = periodLabel ?? PERIOD_LABELS[period] ?? "selected period";
  const otherNetwork = network === "mainnet" ? "testnet" : "mainnet";
  const nextPeriod: WrapPeriod =
    period === "weekly" ? "monthly" : period === "monthly" ? "yearly" : "weekly";

  const startFresh = (navigateTo: string) => {
    setResult(null);
    setStatus("idle");
    router.push(navigateTo);
  };

  return (
    <div
      className={`relative z-20 mx-auto flex w-full max-w-lg flex-col items-center justify-center px-6 py-12 text-center ${className}`}
      data-testid="zero-activity-empty-state"
      role="status"
      aria-live="polite"
    >
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-black/40"
        aria-hidden="true"
      >
        <Inbox className="h-8 w-8 text-white/70" />
      </div>

      <h2 className="sm-text-3xl mb-3 text-2xl font-black tracking-tight text-white">
        No activity in this period
      </h2>
      <p className="sm-text-base mb-8 w-full text-sm leading-relaxed break-words text-white/60">
        This account is valid, but we found zero transactions for the {label} on{" "}
        <span className="font-semibold text-white/80">{network}</span>. Try a wider window or switch
        networks — no mock stats here.
      </p>

      <div className="sm-flex-row flex w-full flex-col flex-wrap items-stretch justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            setPeriod(nextPeriod);
            startFresh("/loading");
          }}
          className="sm-w-auto inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold whitespace-normal text-white transition-colors hover:bg-white/10"
        >
          <CalendarRange className="h-4 w-4 shrink-0" aria-hidden="true" />
          Try {PERIOD_LABELS[nextPeriod]}
        </button>

        <button
          type="button"
          onClick={() => {
            setNetwork(otherNetwork);
            startFresh("/loading");
          }}
          className="sm-w-auto inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold whitespace-normal text-white transition-colors hover:bg-white/10"
        >
          <Globe2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Switch to {otherNetwork}
        </button>

        <button
          type="button"
          onClick={() => {
            reset();
            router.push("/connect");
          }}
          className="sm-w-auto inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-[var(--color-theme-primary)]/40 bg-[var(--color-theme-primary)]/15 px-4 py-3 text-sm font-semibold whitespace-normal text-white transition-colors hover:bg-[var(--color-theme-primary)]/25"
        >
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
          Change wallet
        </button>
      </div>
    </div>
  );
}
