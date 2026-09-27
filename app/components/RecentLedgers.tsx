"use client";

import { motion } from "framer-motion";
import { RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { useRecentLedgers, useLedgerMutation, type NetworkType } from "@/app/hooks/useRecentLedgers";
import { useWrapStore } from "@/app/store/wrapStore";
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface RecentLedgersProps {
  limit?: number;
  showMutationExample?: boolean;
}

export function RecentLedgers({ limit = 10, showMutationExample = false }: RecentLedgersProps) {
  const { network } = useWrapStore();
  const {
    ledgers,
    isLoading,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useRecentLedgers({ network: network as NetworkType, limit });

  const { mutateLedger, isLoading: isMutating } = useLedgerMutation({
    onSuccess: () => {
      console.log("Ledger mutation successful");
    },
    onError: (error) => {
      console.error("Ledger mutation failed:", error);
    },
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleLoadMore = () => {
    fetchNextPage();
  };

  const handleMutationExample = (ledgerId: string) => {
    if (showMutationExample) {
      mutateLedger(ledgerId);
    }
  };

  // Virtualizer for the ledger list — only renders visible items
  const containerRef = useRef<HTMLDivElement>(null);

  const ledgerVirtualizer = useVirtualizer({
    count: ledgers?.length ?? 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        <span className="ml-3 text-white/70">Loading recent ledgers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-400 mb-1">Error loading ledgers</h3>
            <p className="text-xs text-red-300/70 mb-3">{error.message}</p>
            <button
              onClick={handleRefresh}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!ledgers || ledgers.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm text-white/50 text-center">No recent ledgers found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Recent Ledgers</h2>
        <button
          onClick={handleRefresh}
          className="p-2 rounded-lg hover:bg-white/10 transition"
          aria-label="Refresh ledgers"
        >
          <RefreshCw className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Virtualized ledger list */}
      <div
        ref={containerRef}
        style={{ maxHeight: '600px', overflow: 'auto' }}
      >
        <div style={{ height: `${ledgerVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {ledgerVirtualizer.getVirtualItems().map((virtualRow) => {
            const ledger = ledgers[virtualRow.index];
            return (
              <motion.div
                key={ledger.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: virtualRow.index * 0.05 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-emerald-400">#{ledger.sequence}</span>
                      <span className="text-xs text-white/50">
                        {new Date(ledger.closed_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-white/50">Transactions:</span>
                        <span className="ml-2 text-white font-medium">
                          {ledger.successful_transaction_count} / {ledger.failed_transaction_count}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/50">Operations:</span>
                        <span className="ml-2 text-white font-medium">{ledger.operation_count}</span>
                      </div>
                      <div>
                        <span className="text-white/50">Base Fee:</span>
                        <span className="ml-2 text-white font-medium">{ledger.base_fee_in_stroops} stroops</span>
                      </div>
                      <div>
                        <span className="text-white/50">Protocol:</span>
                        <span className="ml-2 text-white font-medium">v{ledger.protocol_version}</span>
                      </div>
                    </div>
                  </div>
                  {showMutationExample && (
                    <button
                      onClick={() => handleMutationExample(ledger.id)}
                      disabled={isMutating}
                      className="px-3 py-1.5 rounded-lg border border-primary-500/30 text-primary-400 hover:bg-primary-500/10 transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMutating ? "Updating..." : "Simulate Update"}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {hasNextPage && (
        <button
          onClick={handleLoadMore}
          disabled={isFetchingNextPage}
          className="w-full py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition text-sm text-white/70 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isFetchingNextPage ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading more...
            </span>
          ) : (
            "Load More Ledgers"
          )}
        </button>
      )}
    </div>
  );
}
