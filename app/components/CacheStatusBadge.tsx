"use client";

import { useWrapStore } from "@/app/store/wrapStore";
import { useCallback } from "react";
import { Database, RefreshCw, Loader2, CheckCircle2, Clock } from "lucide-react";
import { invalidateCache, getCachedDataKey } from "@/app/services/cacheService";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";

const STALE_CACHE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function formatCacheAge(timestamp: number): string {
  const ageMs = Date.now() - timestamp;
  const ageMin = Math.floor(ageMs / 60_000);
  const ageSec = Math.floor((ageMs % 60_000) / 1000);

  if (ageMin >= 60) {
    const h = Math.floor(ageMin / 60);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  }
  if (ageMin > 0) return ageMin === 1 ? "1 min ago" : `${ageMin} min ago`;
  return ageSec <= 10 ? "just now" : `${ageSec}s ago`;
}

function formatLastIndexed(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CacheStatusBadge() {
  const {
    cacheMeta,
    address,
    network,
    period,
    isRefreshing,
    bumpRefreshToken,
    setRefreshing,
  } = useWrapStore();

  const isOnline = useOnlineStatus();

  const isStale =
    cacheMeta?.fromCache === true &&
    cacheMeta.cacheTimestamp != null &&
    Date.now() - cacheMeta.cacheTimestamp > STALE_CACHE_THRESHOLD_MS;

  const handleRefresh = useCallback(async () => {
    if (!address || !isOnline || isRefreshing) return;

    const key = getCachedDataKey(
      address,
      network as "mainnet" | "testnet",
      period as "weekly" | "biweekly" | "monthly" | "yearly",
    );

    setRefreshing(true);
    await invalidateCache(key);
    bumpRefreshToken();
  }, [address, isOnline, isRefreshing, network, period, bumpRefreshToken, setRefreshing]);

  // Don't show anything if there's no cache info
  if (!cacheMeta) return null;

  // Determine status
  const isFromCache = cacheMeta.fromCache;
  const isBackgroundRefreshing = cacheMeta.refreshingInBackground; // renamed to avoid conflict
  const isOffline = cacheMeta.offline;
  const hasTimestamp = cacheMeta.cacheTimestamp != null;

  // Choose icon and label based on freshness
  let statusIcon = <Database className="w-4 h-4 text-emerald-400 shrink-0" />;
  let statusLabel = "Using cached data";
  let statusColor = "text-emerald-400";

  if (isBackgroundRefreshing) {
    statusIcon = <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />;
    statusLabel = "Refreshing in background...";
    statusColor = "text-amber-400";
  } else if (!isFromCache) {
    statusIcon = <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />;
    statusLabel = "Fresh data";
    statusColor = "text-green-400";
  } else if (isOffline) {
    statusIcon = <Database className="w-4 h-4 text-orange-400 shrink-0" />;
    statusLabel = "Using offline cached data";
    statusColor = "text-orange-400";
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-2">
      {/* Status line */}
      <div className="flex items-center gap-2 text-sm">
        {statusIcon}
        <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Last indexed time */}
      {hasTimestamp && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>
            Last indexed: {formatLastIndexed(cacheMeta.cacheTimestamp!)}
            {" · "}
            {formatCacheAge(cacheMeta.cacheTimestamp!)}
          </span>
        </div>
      )}

      {/* Background refresh indicator */}
      {isBackgroundRefreshing && (
        <p className="text-xs text-amber-400/80">
          New data will appear automatically when ready.
        </p>
      )}

      {/* Manual refresh button */}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={!isOnline || isRefreshing}
        className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        {isRefreshing
          ? "Refreshing..."
          : isOnline
            ? "Refresh data"
            : "Refresh unavailable offline"}
      </button>
    </div>
  );
}
