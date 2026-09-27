"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWrapStore } from "@/app/store/wrapStore";
import type { PersistedIndexingState } from "@/app/types/indexing";

const PERSISTENCE_KEY = "stellar-wrap-indexing-state";
const PERSISTENCE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export type RecoveryStatus = "resumable" | "expired" | "none";

export interface PersistedSnapshot {
  state: PersistedIndexingState;
  status: RecoveryStatus;
  ageMs: number;
}

/**
 * Peek at the persisted indexing state without modifying it.
 * Returns null when there is nothing stored or parsing fails.
 */
export function peekPersistedState(): PersistedSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(PERSISTENCE_KEY);
    if (!raw) return null;

    const state: PersistedIndexingState = JSON.parse(raw);
    const ageMs = Date.now() - state.timestamp;
    const status: RecoveryStatus =
      ageMs > PERSISTENCE_TIMEOUT ? "expired" : "resumable";

    return { state, status, ageMs };
  } catch {
    return null;
  }
}

/**
 * Banner displayed on app reload when persisted indexing state is detected.
 * Offers resume / restart / clear actions depending on whether the state
 * is still within the persistence timeout window.
 */
export function ProgressRecoveryBanner() {
  const router = useRouter();
  const {
    setAddress,
    setPeriod,
    setNetwork,
    loadIndexingState,
    clearPersistedIndexingState,
    resetIndexing,
  } = useWrapStore();

  const [snapshot, setSnapshot] = useState<PersistedSnapshot | null>(null);

  useEffect(() => {
    setSnapshot(peekPersistedState());
  }, []);

  if (!snapshot) return null;

  const { state, status } = snapshot;
  const progressPct = state.overallProgress ?? 0;
  const addressLabel = state.address
    ? `${state.address.slice(0, 4)}...${state.address.slice(-4)}`
    : "unknown";

  const handleResume = () => {
    // Restore store state so loadIndexingState can match address/network/period
    if (state.address) setAddress(state.address);
    if (state.network) setNetwork(state.network as "mainnet" | "testnet");
    if (state.period && state.period !== "biweekly") {
      setPeriod(state.period as "weekly" | "monthly" | "yearly");
    }

    const loaded = loadIndexingState();
    if (loaded) {
      router.push("/loading");
    } else {
      // State didn't match or expired — clear and dismiss
      clearPersistedIndexingState();
      setSnapshot(null);
    }
  };

  const handleRestart = () => {
    // Restore address/network/period but start indexing fresh
    if (state.address) setAddress(state.address);
    if (state.network) setNetwork(state.network as "mainnet" | "testnet");
    if (state.period && state.period !== "biweekly") {
      setPeriod(state.period as "weekly" | "monthly" | "yearly");
    }
    clearPersistedIndexingState();
    setSnapshot(null);
    router.push("/loading");
  };

  const handleClear = () => {
    clearPersistedIndexingState();
    resetIndexing();
    setSnapshot(null);
  };

  return (
    <div
      role="alert"
      data-testid="progress-recovery-banner"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
    >
      <div className="rounded-xl border border-white/15 bg-[#0d0d1a]/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <h2 className="text-sm font-semibold text-white">
            {status === "expired"
              ? "Previous session expired"
              : "Previous session found"}
          </h2>
        </div>

        {/* Details */}
        <p className="text-xs text-white/50 mb-3">
          {status === "expired" ? (
            <>
              An indexing session for <span className="font-medium text-white/70">{addressLabel}</span> was
              saved but has expired. You can restart or clear it.
            </>
          ) : (
            <>
              Indexing for <span className="font-medium text-white/70">{addressLabel}</span> was{" "}
              <span className="font-medium text-white/70">{progressPct}%</span> complete
              on <span className="font-medium text-white/70">{state.network}</span>.
            </>
          )}
        </p>

        {/* Progress bar */}
        {status === "resumable" && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 mb-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {status === "resumable" && (
            <button
              type="button"
              onClick={handleResume}
              className="flex-1 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400 transition-colors"
            >
              Resume
            </button>
          )}
          <button
            type="button"
            onClick={handleRestart}
            className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg px-3 py-2 text-xs font-medium text-white/40 hover:text-white/60 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
