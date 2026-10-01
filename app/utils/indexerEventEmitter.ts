/**
 * Event Emitter pattern for Indexer Service
 * This file demonstrates how the Indexer Service should emit progress events
 * to the Zustand store for UI updates.
 *
 * This is a reference implementation for Issue #34 (Indexer Service)
 */

import { EventEmitter } from "events";
import { IndexingStep, IndexingMetrics } from "@/app/types/indexing";
import { useWrapStore } from "@/app/store/wrapStore";

/**
 * Event types emitted by the indexer service
 */
export type IndexerEvent =
  | { type: "step-change"; step: IndexingStep }
  | { type: "step-progress"; step: IndexingStep; progress: number }
  | { type: "step-complete"; step: IndexingStep }
  | {
      type: "step-error";
      step: IndexingStep;
      message: string;
      recoverable: boolean;
    }
  | { type: "indexing-complete"; data: unknown }
  | { type: "indexing-cancelled" }
  | { type: "metrics-update"; metrics: Partial<IndexingMetrics> };

/**
 * Singleton event emitter for indexer service
 */
export class IndexerEventEmitter extends EventEmitter {
  private static instance: IndexerEventEmitter;
  private isConnected: boolean = false;

  private constructor() {
    super();
  }

  static getInstance(): IndexerEventEmitter {
    if (!IndexerEventEmitter.instance) {
      IndexerEventEmitter.instance = new IndexerEventEmitter();
    }
    return IndexerEventEmitter.instance;
  }

  /**
   * Emit step change event
   */
  emitStepChange(step: IndexingStep): void {
    this.emit("step-change", { type: "step-change", step });
  }

  /**
   * Emit step progress update (0-100)
   */
  emitStepProgress(step: IndexingStep, progress: number): void {
    this.emit("step-progress", { type: "step-progress", step, progress });
  }

  /**
   * Emit step completion
   */
  emitStepComplete(step: IndexingStep): void {
    this.emit("step-complete", { type: "step-complete", step });
  }

  /**
   * Emit step error
   */
  emitStepError(step: IndexingStep, message: string, recoverable = true): void {
    this.emit("step-error", { type: "step-error", step, message, recoverable });
  }

  /**
   * Emit indexing completion
   */
  emitIndexingComplete(data: unknown): void {
    this.emit("indexing-complete", { type: "indexing-complete", data });
  }

  /**
   * Emit indexing cancellation
   */
  emitIndexingCancelled(): void {
    this.emit("indexing-cancelled", { type: "indexing-cancelled" });
  }

  /**
   * Emit metrics update
   */
  emitMetricsUpdate(metrics: Partial<IndexingMetrics>): void {
    this.emit("metrics-update", { type: "metrics-update", metrics });
  }

  /**
   * Connect emitter to Zustand store (call once during app initialization)
   * Safe to call multiple times - will only connect once per session.
   * Call {@link reset} between loading sessions so listeners are not duplicated.
   */
  connectToStore(): void {
    // Prevent duplicate listener registration across repeated sessions
    if (this.isConnected) {
      return;
    }

    const store = useWrapStore;

    // EventEmitter's own .on() listener signature is untyped
    // ((...args: any[]) => void), so each callback here is explicitly
    // typed against the matching IndexerEvent member — otherwise the
    // destructured `step` etc. below is implicitly `any`.
    this.on("step-change", ({ step }: Extract<IndexerEvent, { type: "step-change" }>) => {
      store.getState().setCurrentStep(step);
    });

    this.on(
      "step-progress",
      ({ step, progress }: Extract<IndexerEvent, { type: "step-progress" }>) => {
        const state = store.getState();
        // Drop late events after step completion (defense in depth; store also clamps)
        if (state.completedStepRecord[step]) {
          return;
        }
        store.getState().setStepProgress(step, progress);
      },
    );

    this.on("step-complete", ({ step }: Extract<IndexerEvent, { type: "step-complete" }>) => {
      store.getState().completeStep(step);
    });

    this.on(
      "step-error",
      ({ step, message, recoverable }: Extract<IndexerEvent, { type: "step-error" }>) => {
        store.getState().setIndexingError(step, message, recoverable);
      },
    );

    this.on("indexing-complete", () => {
      store.getState().clearPersistedIndexingState();
    });

    this.on("indexing-cancelled", () => {
      store.getState().cancelIndexing();
    });

    this.isConnected = true;
  }

  /**
   * Whether store listeners are currently attached.
   */
  isStoreConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect store listeners (cleanup)
   */
  disconnectFromStore(): void {
    this.removeAllListeners();
    this.isConnected = false;
  }

  /**
   * Remove all listeners and reset connection so the next session can
   * safely call {@link connectToStore} without duplicate store updates.
   */
  reset(): void {
    this.removeAllListeners();
    this.isConnected = false;
  }
}

/**
 * Example usage in Indexer Service
 * ================================
 *
 * import { IndexerEventEmitter } from '@/app/utils/indexerEventEmitter';
 *
 * export async function indexAccount(
 *   accountId: string,
 *   network: 'mainnet' | 'testnet' = 'mainnet',
 *   period: WrapPeriod = 'monthly',
 * ): Promise<IndexerResult> {
 *   const emitter = IndexerEventEmitter.getInstance();
 *
 *   try {
 *     // Step 1: Initialize
 *     emitter.emitStepChange('initializing');
 *     const server = getHorizonServer(network);
 *     emitter.emitStepComplete('initializing');
 *
 *     // Step 2: Fetch transactions
 *     emitter.emitStepChange('fetching-transactions');
 *     let transactionCount = 0;
 *     let cursor: string | undefined;
 *     let hasMore = true;
 *
 *     while (hasMore) {
 *       const response = await server.transactions()
 *         .forAccount(accountId)
 *         .limit(200)
 *         .cursor(cursor)
 *         .call();
 *
 *       // Emit progress (estimate based on fetched records)
 *       transactionCount += response.records.length;
 *       const estimatedTotal = 2000; // Adjust based on real data
 *       const progress = Math.min(100, (transactionCount / estimatedTotal) * 100);
 *       emitter.emitStepProgress('fetching-transactions', progress);
 *
 *       hasMore = response.records.length === 200;
 *       cursor = response.paging_token;
 *     }
 *     emitter.emitStepComplete('fetching-transactions');
 *
 *     // Step 3: Filter timeframes
 *     emitter.emitStepChange('filtering-timeframes');
 *     const days = PERIODS[period];
 *     const cutoffDate = new Date();
 *     cutoffDate.setDate(cutoffDate.getDate() - days);
 *
 *     const filteredTxs = transactions.filter(tx => {
 *       const txDate = new Date(tx.created_at);
 *       return txDate >= cutoffDate;
 *     });
 *     emitter.emitStepProgress('filtering-timeframes', 100);
 *     emitter.emitStepComplete('filtering-timeframes');
 *
 *     // Step 4: Calculate volume
 *     emitter.emitStepChange('calculating-volume');
 *     let totalVolume = 0;
 *     filteredTxs.forEach((tx, idx) => {
 *       totalVolume += calculateTxVolume(tx);
 *       emitter.emitStepProgress('calculating-volume', (idx / filteredTxs.length) * 100);
 *     });
 *     emitter.emitStepComplete('calculating-volume');
 *
 *     // Step 5: Identify assets
 *     emitter.emitStepChange('identifying-assets');
 *     const assetCounts = new Map<string, number>();
 *     filteredTxs.forEach((tx, idx) => {
 *       const operations = tx.operations as Operation[];
 *       operations.forEach(op => {
 *         if (op.type === 'payment') {
 *           const key = `${op.asset_code}:${op.asset_issuer}`;
 *           assetCounts.set(key, (assetCounts.get(key) || 0) + 1);
 *         }
 *       });
 *       emitter.emitStepProgress('identifying-assets', (idx / filteredTxs.length) * 100);
 *     });
 *     emitter.emitStepComplete('identifying-assets');
 *
 *     // Step 6: Count contracts
 *     emitter.emitStepChange('counting-contracts');
 *     let contractCount = 0;
 *     filteredTxs.forEach((tx, idx) => {
 *       const operations = tx.operations as Operation[];
 *       contractCount += operations.filter(op => op.type === 'invoke_host_function').length;
 *       emitter.emitStepProgress('counting-contracts', (idx / filteredTxs.length) * 100);
 *     });
 *     emitter.emitStepComplete('counting-contracts');
 *
 *     // Step 7: Finalize
 *     emitter.emitStepChange('finalizing');
 *     const result = {
 *       accountId,
 *       totalTransactions: filteredTxs.length,
 *       totalVolume,
 *       topAssets: Array.from(assetCounts.entries()).sort((a, b) => b[1] - a[1]),
 *       contractInteractions: contractCount,
 *     };
 *     emitter.emitStepProgress('finalizing', 100);
 *     emitter.emitStepComplete('finalizing');
 *
 *     // Success!
 *     emitter.emitIndexingComplete(result);
 *     return result;
 *
 *   } catch (error) {
 *     // Emit appropriate error for the current step
 *     const currentStep = 'fetching-transactions'; // Track this somehow
 *     const message = error instanceof Error ? error.message : 'Unknown error';
 *     const recoverable = isNetworkError(error); // Helper function
 *     emitter.emitStepError(currentStep, message, recoverable);
 *     throw error;
 *   }
 * }
 *
 *
 * App Initialization (app/providers.tsx or app/layout.tsx)
 * ========================================================
 *
 * import { IndexerEventEmitter } from '@/app/utils/indexerEventEmitter';
 *
 * export function Providers({ children }: { children: React.ReactNode }) {
 *   // Initialize emitter connection to store on app load
 *   React.useEffect(() => {
 *     IndexerEventEmitter.getInstance().connectToStore();
 *     return () => {
 *       IndexerEventEmitter.getInstance().reset();
 *     };
 *   }, []);
 *
 *   return (
 *     // ... providers
 *   );
 * }
 */

export default IndexerEventEmitter;
