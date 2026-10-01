"use client";

import { useEffect } from "react";
import {
  getMostRecentCachedData,
  parseCachedDataKey,
} from "@/app/services/cacheService";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";
import { useWrapStore } from "@/app/store/wrapStore";
import { mapIndexerResultToWrapResult } from "@/app/utils/wrapResultMapper";

export function OfflineWrapHydrator() {
  const isOnline = useOnlineStatus();
  const {
    result,
    setAddress,
    setNetwork,
    setPeriod,
    setResult,
    setStatus,
    setCacheMeta,
  } = useWrapStore();

  useEffect(() => {
    if (isOnline || result) return;

    let cancelled = false;

    const hydrateFromCache = async () => {
      const cached = await getMostRecentCachedData();
      if (!cached || cancelled) return;

      const parsed = parseCachedDataKey(cached.key);
      if (parsed) {
        setAddress(parsed.accountAddress);
        setNetwork(parsed.network);
        if (parsed.timeframe !== "biweekly") {
          setPeriod(parsed.timeframe);
        }
      }

      setResult(mapIndexerResultToWrapResult(cached.result));
      setCacheMeta({
        fromCache: true,
        cacheTimestamp: cached.timestamp,
        offline: true,
      });
      setStatus("ready");
    };

    void hydrateFromCache();

    return () => {
      cancelled = true;
    };
  }, [
    isOnline,
    result,
    setAddress,
    setCacheMeta,
    setNetwork,
    setPeriod,
    setResult,
    setStatus,
  ]);

  return null;
}
