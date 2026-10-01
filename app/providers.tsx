"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServiceWorkerManager } from "./components/ServiceWorkerManager";
import { OfflineWrapHydrator } from "./components/OfflineWrapHydrator";
import { OfflineBanner } from "./components/OfflineBanner";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";

/**
 * React Query cache defaults.
 *
 * Freshness is deliberate per data type rather than copied per-hook:
 * - Exchange rates are short-lived (prices move constantly), so they opt into a
 *   short staleTime and a modest refetch interval at the hook level.
 * - A completed wrap is effectively immutable once confirmed, so wrap queries
 *   opt into `staleTime: Infinity` and never refetch on their own.
 * - Ledger data is append-only: existing entries never change, so a long
 *   staleTime is safe and avoids hammering Horizon.
 *
 * The defaults below suit the common case (append-only / immutable reads).
 * Hooks override them only when their data has genuinely different freshness
 * needs, with a comment stating why.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Common case: append-only ledger data and immutable confirmed wraps.
        // A long staleTime keeps Horizon request volume low; hooks that read
        // fast-moving data (e.g. exchange rates) override this deliberately.
        staleTime: 5 * 60 * 1000,
        // Retries are handled by the request queue, which already applies
        // backoff and deduplicates in-flight requests. Retrying here as well
        // would compound into more requests than either layer intends, so we
        // disable React Query's own retry and let the queue own it.
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  }));

  useEffect(() => {
    if (typeof window !== "undefined") {
      import("@/app/utils/wallet").then(({ initWalletKit }) => {
        initWalletKit();
      }).catch(console.error);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ServiceWorkerManager />
        <OfflineWrapHydrator />
        <OfflineBanner />
        {children}
        <PwaInstallPrompt />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
