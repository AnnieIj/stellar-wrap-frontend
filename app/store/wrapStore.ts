import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Network, DEFAULT_NETWORK } from "../../src/config";
import {
  getContractAddress,
  getContractConfigForAllNetworks,
} from "../../config/contracts";
import { CacheStore } from "@/app/utils/indexer";
import {
  IndexingStep,
  IndexingError,
  INDEXING_STEPS,
  STEP_ORDER,
  PersistedIndexingState,
  IndexingMetrics,
} from "@/app/types/indexing";
import {
  OptimisticNetworkSwitchState,
  OptimisticNetworkSwitchActions,
  NetworkSwitchFailureReason,
} from "@/app/types/networkSwitch";
import { horizonIndexer } from "@/src/services/horizonIndexer";
import { logger } from "@/app/utils/logger";

const log = logger.child("wrapStore");

const PERSISTENCE_KEY = "stellar-wrap-indexing-state";
const PERSISTENCE_TIMEOUT = 5 * 60 * 1000;

export type WrapPeriod = "weekly" | "monthly" | "yearly";

/** Day-count window per period, kept in sync with `app/utils/indexer.ts`'s PERIODS. */
export const PERIODS: Record<WrapPeriod, number> = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

export interface DappData {
  name: string;
  logo?: string;
  icon?: string;
  interactions: number;
  isFanFavorite?: boolean;
  color?: string;
  gradient?: string;
}

export interface VibeSlice {
  type: string;
  percentage: number;
  color: string;
  label: string;
}

import type { DexTradingSummary as DexTradingSummaryType, SorobanBuilderSummary as SorobanBuilderSummaryType, PortfolioDiversitySummary as PortfolioDiversitySummaryType, BiggestDaySummary as BiggestDaySummaryType, NftActivitySummary as NftActivitySummaryType } from "@/app/utils/indexer";

export interface WrapResult {
  username: string;
  totalTransactions: number;
  percentile: number;
  dapps: DappData[];
  vibes: VibeSlice[];
  persona: string;
  personaDescription: string;
  dexTradingSummary?: DexTradingSummaryType;
  sorobanBuilderSummary?: SorobanBuilderSummaryType;
  portfolioDiversitySummary?: PortfolioDiversitySummaryType;
  biggestDaySummary?: BiggestDaySummaryType;
  nftActivitySummary?: NftActivitySummaryType;
  largestTransaction?: { amount: number; assetCode: string };
}

type WrapStatus = "idle" | "loading" | "ready" | "error";

export interface CacheMeta {
  fromCache: boolean;
  cacheTimestamp?: number;
  refreshingInBackground?: boolean;
  offline?: boolean;
}

export type ContractAddressesByNetwork = Partial<Record<Network, string>>;

let cacheStore: CacheStore = {};

export function getCacheStore(): CacheStore {
  return cacheStore;
}

export function resetCache(): void {
  cacheStore = {};
}

const initialCompletedStepRecord: Record<IndexingStep, boolean> = {
  initializing: false,
  "fetching-transactions": false,
  "filtering-timeframes": false,
  "calculating-volume": false,
  "identifying-assets": false,
  "counting-contracts": false,
  finalizing: false,
};

const initialIndexingState = {
  currentStep: null as IndexingStep | null,
  stepProgress: {
    initializing: 0,
    "fetching-transactions": 0,
    "filtering-timeframes": 0,
    "calculating-volume": 0,
    "identifying-assets": 0,
    "counting-contracts": 0,
    finalizing: 0,
  } as Record<IndexingStep, number>,
  completedStepRecord: { ...initialCompletedStepRecord },
  overallProgress: 0,
  completedSteps: 0,
  totalSteps: STEP_ORDER.length,
  startTime: null as number | null,
  estimatedTimeRemaining: null as number | null,
  indexingError: null as IndexingError | null,
  isLoading: false,
  isCancelled: false,
  metrics: {
    transactionCount: 0,
    totalTransactions: null,
    assetCount: 0,
    contractCount: 0,
    volumeProcessed: "0",
    timeframesProcessed: 0,
  },
};

const initialOptimisticSwitchState: OptimisticNetworkSwitchState = {
  phase: "idle",
  previousNetwork: null,
  optimisticNetwork: null,
  switchError: null,
  failureReason: null,
  switchAttempt: 0,
};

interface WrapStoreState
  extends OptimisticNetworkSwitchState,
    OptimisticNetworkSwitchActions {
  address: string | null;
  period: WrapPeriod;
  network: Network;
  status: WrapStatus;
  error: string | null;
  result: WrapResult | null;
  cacheMeta: CacheMeta | null;
  currentContractAddress: string | null;
  contractAddresses: ContractAddressesByNetwork;
  refreshToken: number;
  isRefreshing: boolean;
  assetList: string[];
  setAssetList: (assets: string[]) => void;
  // Indexing state
  currentStep: IndexingStep | null;
  stepProgress: Record<IndexingStep, number>;
  completedStepRecord: Record<IndexingStep, boolean>;
  overallProgress: number;
  completedSteps: number;
  totalSteps: number;
  startTime: number | null;
  estimatedTimeRemaining: number | null;
  indexingError: IndexingError | null;
  isLoading: boolean;
  isCancelled: boolean;
  metrics: IndexingMetrics;
  // Setters
  setAddress: (address: string | null) => void;
  setPeriod: (period: WrapPeriod) => void;
  setNetwork: (network: Network) => void;
  setStatus: (status: WrapStatus) => void;
  setError: (error: string | null) => void;
  setResult: (result: WrapResult | null) => void;
  setCacheMeta: (meta: CacheMeta | null) => void;
  setContractAddresses: (addresses: ContractAddressesByNetwork) => void;
  setRefreshing: (isRefreshing: boolean) => void;
  bumpRefreshToken: () => void;
  reset: () => void;
  // Indexing actions
  setCurrentStep: (step: IndexingStep | null) => void;
  setStepProgress: (step: IndexingStep, progress: number) => void;
  updateOverallProgress: () => void;
  setIndexingError: (
    step: IndexingStep,
    message: string,
    recoverable?: boolean,
  ) => void;
  clearIndexingError: () => void;
  startIndexing: () => void;
  completeStep: (step: IndexingStep) => void;
  cancelIndexing: () => void;
  resetIndexing: () => void;
  completeIndexing: () => void;
  syncIndexingProgress: () => void;
  saveIndexingState: () => void;
  loadIndexingState: () => boolean;
  clearPersistedIndexingState: () => void;
  updateMetrics: (metrics: Partial<IndexingMetrics>) => void;
}

function syncContractState(network: Network): {
  currentContractAddress: string | null;
  contractAddresses: ContractAddressesByNetwork;
} {
  try {
    const config = getContractConfigForAllNetworks();
    const currentContractAddress = getContractAddress(network);
    return {
      currentContractAddress,
      contractAddresses: {
        mainnet: config.mainnet?.contractAddress,
        testnet: config.testnet?.contractAddress,
      },
    };
  } catch {
    return {
      currentContractAddress: null,
      contractAddresses: {},
    };
  }
}

export const useWrapStore = create<WrapStoreState>()(
  persist(
    (set, get) => ({
      address: null,
      period: "yearly",
      network: DEFAULT_NETWORK,
      status: "idle",
      error: null,
      result: null,
      cacheMeta: null,
      currentContractAddress: null,
      contractAddresses: {},
      refreshToken: 0,
      isRefreshing: false,
      assetList: [],
      // Indexing initial state
      ...initialIndexingState,
      // Optimistic network switch initial state
      ...initialOptimisticSwitchState,
      setAddress: (address) => set({ address }),
      setPeriod: (period) => set({ period }),
      setNetwork: (network) => {
        // Drop previous network's result/cache so stale wrap data cannot leak across networks.
        // Keep intentional preferences (period, address).
        resetCache();
        // Clear Horizon response cache to prevent stale network data
        horizonIndexer.clearCache();
        // Cancel any in-flight indexing operation
        get().cancelIndexing();
        set({
          network,
          ...syncContractState(network),
          result: null,
          cacheMeta: null,
          status: "idle",
          error: null,
        });
      },
      setStatus: (status) => set({ status }),
      setError: (error) => set({ error }),
      setResult: (result) => set({ result }),
      setCacheMeta: (cacheMeta) => set({ cacheMeta }),
      setContractAddresses: (contractAddresses) => set({ contractAddresses }),
      setRefreshing: (isRefreshing) => set({ isRefreshing }),
      setAssetList: (assetList) => set({ assetList }),
      bumpRefreshToken: () => set((s) => ({ refreshToken: s.refreshToken + 1 })),
      reset: () =>
        set({
          address: null,
          period: "yearly",
          network: DEFAULT_NETWORK,
          status: "idle",
          error: null,
          result: null,
          cacheMeta: null,
          currentContractAddress: null,
          contractAddresses: {},
          refreshToken: 0,
          isRefreshing: false,
          assetList: [],
          ...initialIndexingState,
          ...initialOptimisticSwitchState,
        }),

      // Indexing actions
      setCurrentStep: (step) => {
        set({ currentStep: step });
        get().updateOverallProgress();
        get().saveIndexingState();
      },

      setStepProgress: (step, progress) => {
        const state = get();
        // Ignore stale updates after the step is already complete
        if (state.completedStepRecord[step]) {
          return;
        }
        const next = Math.max(0, Math.min(100, progress));
        const current = state.stepProgress[step] ?? 0;
        // Monotonic: never allow progress to regress within a run
        if (next < current) {
          return;
        }
        set((s) => ({
          stepProgress: {
            ...s.stepProgress,
            [step]: next,
          },
        }));
        get().updateOverallProgress();
      },

      updateOverallProgress: () => {
        const state = get();
        if (!state.isLoading || state.isCancelled) {
          return;
        }

        let totalProgress = 0;
        STEP_ORDER.forEach((step) => {
          const weight = INDEXING_STEPS[step].weight;
          const progress = state.stepProgress[step];
          totalProgress += (progress / 100) * weight;
        });

        let estimatedTimeRemaining: number | null = null;
        if (state.startTime && totalProgress > 0) {
          const elapsedTime = Date.now() - state.startTime;
          const timePerPercent = elapsedTime / totalProgress;
          estimatedTimeRemaining = Math.max(
            0,
            Math.round(timePerPercent * (100 - totalProgress)),
          );
        }

        set({
          overallProgress: Math.round(totalProgress),
          estimatedTimeRemaining,
        });
      },

      setIndexingError: (step, message, recoverable = true) => {
        set({
          indexingError: { step, message, recoverable },
          isLoading: false,
        });
        get().saveIndexingState();
      },

      clearIndexingError: () => {
        set({ indexingError: null });
      },

      startIndexing: () => {
        set({
          ...initialIndexingState,
          isLoading: true,
          startTime: Date.now(),
          totalSteps: STEP_ORDER.length,
          completedSteps: 0,
        });
        get().saveIndexingState();
      },

      completeStep: (step) => {
        set((state) => {
          const record = state.completedStepRecord;
          if (record[step]) return state;
          return {
            completedStepRecord: { ...record, [step]: true },
            stepProgress: {
              ...state.stepProgress,
              [step]: 100,
            },
            completedSteps: Math.min(
              state.completedSteps + 1,
              STEP_ORDER.length,
            ),
          };
        });
        get().updateOverallProgress();
        get().saveIndexingState();
      },

      cancelIndexing: () => {
        set({
          ...initialIndexingState,
          isCancelled: true,
          isLoading: false,
          status: "idle",
          result: null,
          cacheMeta: null,
        });
        get().clearPersistedIndexingState();
      },

      resetIndexing: () => {
        set(initialIndexingState);
        get().clearPersistedIndexingState();
      },

      completeIndexing: () => {
        set((state) => {
          const stepProgress = { ...state.stepProgress };
          const completedStepRecord = { ...state.completedStepRecord };
          STEP_ORDER.forEach((step) => {
            stepProgress[step] = 100;
            completedStepRecord[step] = true;
          });
          return {
            stepProgress,
            completedStepRecord,
            completedSteps: STEP_ORDER.length,
            overallProgress: 100,
            isLoading: false,
            estimatedTimeRemaining: 0,
          };
        });
        get().clearPersistedIndexingState();
      },

      syncIndexingProgress: () => {
        get().updateOverallProgress();
      },

      saveIndexingState: () => {
        const state = get();
        if (!state.isLoading || state.isCancelled) return;

        const stepTimings: Record<IndexingStep, number> = {} as Record<
          IndexingStep,
          number
        >;
        STEP_ORDER.forEach((step) => {
          stepTimings[step] = 0;
        });

        const persistedState: PersistedIndexingState = {
          currentStep: state.currentStep,
          completedSteps: state.completedSteps,
          stepProgress: state.stepProgress,
          overallProgress: state.overallProgress,
          completedStepRecord: state.completedStepRecord,
          stepTimings,
          startTime: state.startTime,
          timestamp: Date.now(),
          address: state.address,
          network: state.network,
          period: state.period,
        };

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(persistedState));
          } catch (error) {
            log.warn("Failed to persist indexing state:", error);
          }
        }
      },

      loadIndexingState: () => {
        if (typeof window === "undefined") return false;

        try {
          const saved = localStorage.getItem(PERSISTENCE_KEY);
          if (!saved) return false;

          const persistedState: PersistedIndexingState = JSON.parse(saved);
          const now = Date.now();
          const state = get();

          const ts = persistedState?.timestamp;
          const timestampValid = typeof ts === "number" && Number.isFinite(ts);

          if (!timestampValid || now - ts >= PERSISTENCE_TIMEOUT) {
            localStorage.removeItem(PERSISTENCE_KEY);
            return false;
          }

          if (
            persistedState.address !== state.address ||
            persistedState.network !== state.network ||
            persistedState.period !== state.period
          ) {
            localStorage.removeItem(PERSISTENCE_KEY);
            return false;
          }

          set({
            currentStep: persistedState.currentStep,
            completedSteps: persistedState.completedSteps,
            stepProgress: persistedState.stepProgress ?? get().stepProgress,
            overallProgress: persistedState.overallProgress ?? 0,
            completedStepRecord:
              persistedState.completedStepRecord ?? get().completedStepRecord,
            startTime: persistedState.startTime,
            isLoading: persistedState.currentStep !== null,
            isCancelled: false,
          });

          get().updateOverallProgress();

          return true;
        } catch (error) {
          log.warn("Failed to load persisted indexing state:", error);
          try {
            localStorage.removeItem(PERSISTENCE_KEY);
          } catch {
            // best effort
          }
          return false;
        }
      },

      clearPersistedIndexingState: () => {
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem(PERSISTENCE_KEY);
          } catch (error) {
            log.warn("Failed to clear persisted state:", error);
          }
        }
      },

      updateMetrics: (metrics) => {
        set((state) => ({
          metrics: {
            ...state.metrics,
            ...metrics,
          },
        }));
      },

      // ─── Optimistic network switch actions ───────────────────────────────────

      beginOptimisticSwitch: (newNetwork: Network) => {
        const { network, switchAttempt } = get();
        set({
          previousNetwork: network,
          optimisticNetwork: newNetwork,
          phase: "switching",
          switchError: null,
          failureReason: null,
          switchAttempt: switchAttempt + 1,
          // Apply the optimistic network update to the UI immediately.
          network: newNetwork,
          ...syncContractState(newNetwork),
        });
      },

      commitNetworkSwitch: () => {
        set({
          phase: "committed",
          previousNetwork: null,
          optimisticNetwork: null,
          switchError: null,
          failureReason: null,
        });
      },

      rollbackNetworkSwitch: (
        reason: NetworkSwitchFailureReason,
        errorMessage: string,
      ) => {
        const { previousNetwork } = get();
        if (previousNetwork === null) {
          // Nothing to roll back – guard against double-calls.
          return;
        }
        // Restore the previous network in the UI and reset dependent state.
        resetCache();
        horizonIndexer.clearCache();
        get().cancelIndexing();
        set({
          phase: "rolled-back",
          network: previousNetwork,
          ...syncContractState(previousNetwork),
          result: null,
          cacheMeta: null,
          status: "idle",
          error: null,
          switchError: errorMessage,
          failureReason: reason,
          previousNetwork: null,
          optimisticNetwork: null,
        });
      },

      clearNetworkSwitchError: () => {
        set({
          phase: "idle",
          switchError: null,
          failureReason: null,
        });
      },
    }),
    {
      name: "stellar-wrap-store",
      partialize: (state) => ({
        address: state.address,
        period: state.period,
        network: state.network,
        result: state.result,
        status: state.status,
        cacheMeta: state.cacheMeta,
        assetList: Array.isArray(state.assetList) ? state.assetList : [],
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<WrapStoreState>;
        return {
          ...currentState,
          ...persisted,
          assetList: Array.isArray(persisted.assetList)
            ? persisted.assetList
            : currentState.assetList,
        };
      },
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
    },
  ),
);
