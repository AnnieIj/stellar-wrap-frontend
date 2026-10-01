/**
 * Zustand store for Exchange Rates state management.
 *
 * Issue #473: Refactor Exchange Rates state to use Zustand
 * - Prevents unnecessary component re-renders via fine-grained selectors
 * - Optimistic updates with instant UI reflection
 * - Rollback mechanism for failed mutations / server fetches
 * - Local caching with TTL to minimize redundant fetches
 * - Strict TypeScript typing without `any`
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface RateQuote {
  rate: number;
  lastUpdated: number;
  source: string;
}

export type RateMap = Record<string, RateQuote>;

export interface ExchangeRateError {
  message: string;
  code?: string;
  timestamp: number;
}

export interface ExchangeRateState {
  /** Map of currency pair / asset key (e.g. 'XLM/USD', 'USDC/USD') to rate quotes */
  rates: RateMap;
  /** Currently active base currency (e.g., 'USD', 'EUR') */
  baseCurrency: string;
  /** Loading status */
  isLoading: boolean;
  /** Last error encountered during update or fetch */
  error: ExchangeRateError | null;
  /** Local cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs: number;
  /** Optimistic update rollback state snapshot */
  rollbackSnapshot: RateMap | null;
}

export interface ExchangeRateActions {
  /** Set a single exchange rate directly */
  setRate: (pair: string, rate: number, source?: string) => void;
  /** Bulk set exchange rates */
  setRates: (rates: Record<string, number>, source?: string) => void;
  /** Set active base currency */
  setBaseCurrency: (currency: string) => void;
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Set error state */
  setError: (error: ExchangeRateError | null) => void;
  /**
   * Optimistically update a rate before network resolution.
   * Stores previous state snapshot for potential rollback.
   */
  setRateOptimistic: (pair: string, rate: number, source?: string) => void;
  /**
   * Rollback the optimistic update back to previous state snapshot.
   */
  rollbackOptimistic: (error?: ExchangeRateError) => void;
  /**
   * Confirm the optimistic update (clears rollback snapshot).
   */
  confirmOptimistic: () => void;
  /** Check if a rate quote for pair is stale based on TTL */
  isRateStale: (pair: string) => boolean;
  /** Convert an amount from asset currency to base currency */
  convertAssetAmount: (amount: number, assetCode: string) => number | null;
  /** Reset store to initial state */
  reset: () => void;
}

export type ExchangeRateStore = ExchangeRateState & ExchangeRateActions;

export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const DEFAULT_RATES: RateMap = {
  "XLM/USD": {
    rate: 0.12,
    lastUpdated: 0,
    source: "default",
  },
  "USDC/USD": {
    rate: 1.0,
    lastUpdated: 0,
    source: "default",
  },
  "USDT/USD": {
    rate: 1.0,
    lastUpdated: 0,
    source: "default",
  },
};

const initialExchangeRateState: ExchangeRateState = {
  rates: DEFAULT_RATES,
  baseCurrency: "USD",
  isLoading: false,
  error: null,
  cacheTtlMs: DEFAULT_CACHE_TTL_MS,
  rollbackSnapshot: null,
};

export const useExchangeRateStore = create<ExchangeRateStore>()(
  persist(
    (set, get) => ({
      ...initialExchangeRateState,

      setRate: (pair: string, rate: number, source = "manual") => {
        const normalizedPair = pair.toUpperCase();
        set((state) => ({
          rates: {
            ...state.rates,
            [normalizedPair]: {
              rate,
              lastUpdated: Date.now(),
              source,
            },
          },
          error: null,
        }));
      },

      setRates: (newRates: Record<string, number>, source = "remote") => {
        const now = Date.now();
        set((state) => {
          const updated: RateMap = { ...state.rates };
          for (const [pair, rate] of Object.entries(newRates)) {
            updated[pair.toUpperCase()] = {
              rate,
              lastUpdated: now,
              source,
            };
          }
          return { rates: updated, error: null, isLoading: false };
        });
      },

      setBaseCurrency: (currency: string) => {
        set({ baseCurrency: currency.toUpperCase() });
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },

      setError: (error: ExchangeRateError | null) => {
        set({ error, isLoading: false });
      },

      setRateOptimistic: (pair: string, rate: number, source = "optimistic") => {
        const normalizedPair = pair.toUpperCase();
        const currentRates = get().rates;

        // Save current rates snapshot before applying optimistic change
        set({
          rollbackSnapshot: { ...currentRates },
          rates: {
            ...currentRates,
            [normalizedPair]: {
              rate,
              lastUpdated: Date.now(),
              source,
            },
          },
          error: null,
        });
      },

      rollbackOptimistic: (error?: ExchangeRateError) => {
        const { rollbackSnapshot } = get();
        if (rollbackSnapshot) {
          set({
            rates: rollbackSnapshot,
            rollbackSnapshot: null,
            error: error ?? {
              message: "Optimistic update failed and was rolled back.",
              timestamp: Date.now(),
            },
            isLoading: false,
          });
        }
      },

      confirmOptimistic: () => {
        set({ rollbackSnapshot: null, error: null });
      },

      isRateStale: (pair: string): boolean => {
        const { rates, cacheTtlMs } = get();
        const quote = rates[pair.toUpperCase()];
        if (!quote || quote.lastUpdated === 0) {
          return true;
        }
        return Date.now() - quote.lastUpdated > cacheTtlMs;
      },

      convertAssetAmount: (amount: number, assetCode: string): number | null => {
        const { rates, baseCurrency } = get();
        const normalizedAsset = assetCode.toUpperCase();
        if (normalizedAsset === baseCurrency) {
          return amount;
        }

        const pairKey = `${normalizedAsset}/${baseCurrency}`;
        const quote = rates[pairKey];
        if (!quote) {
          return null;
        }
        return amount * quote.rate;
      },

      reset: () => {
        set({
          ...initialExchangeRateState,
          rates: { ...DEFAULT_RATES },
        });
      },
    }),
    {
      name: "stellar-wrap-exchange-rates",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      partialize: (state) => ({
        rates: state.rates,
        baseCurrency: state.baseCurrency,
        cacheTtlMs: state.cacheTtlMs,
      }),
    },
  ),
);

// ── Selectors for fine-grained subscriptions ──────────────────────────────────

export const selectExchangeRate = (pair: string) => (state: ExchangeRateStore) =>
  state.rates[pair.toUpperCase()]?.rate ?? null;

export const selectExchangeQuote = (pair: string) => (state: ExchangeRateStore) =>
  state.rates[pair.toUpperCase()] ?? null;

export const selectBaseCurrency = (state: ExchangeRateStore) =>
  state.baseCurrency;

export const selectIsLoadingRates = (state: ExchangeRateStore) =>
  state.isLoading;

export const selectExchangeRateError = (state: ExchangeRateStore) =>
  state.error;
