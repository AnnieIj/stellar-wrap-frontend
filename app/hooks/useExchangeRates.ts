/**
 * Custom React hooks for consuming Exchange Rates state with fine-grained subscriptions.
 *
 * Issue #473: Refactor Exchange Rates state to use Zustand
 */

import { useCallback } from "react";
import {
  useExchangeRateStore,
  selectExchangeRate,
  selectExchangeQuote,
  selectBaseCurrency,
  selectIsLoadingRates,
  selectExchangeRateError,
  RateQuote,
  ExchangeRateError,
} from "../store/exchangeRateStore";

/**
 * Hook to retrieve a single exchange rate for a given pair (e.g. 'XLM/USD').
 * Subscribes only to this specific pair's rate to prevent re-renders when other rates change.
 */
export function useExchangeRate(pair: string): number | null {
  return useExchangeRateStore(selectExchangeRate(pair));
}

/**
 * Hook to retrieve full quote details (rate, timestamp, source) for a pair.
 */
export function useExchangeQuote(pair: string): RateQuote | null {
  return useExchangeRateStore(selectExchangeQuote(pair));
}

/**
 * Hook to retrieve active base currency.
 */
export function useBaseCurrency(): string {
  return useExchangeRateStore(selectBaseCurrency);
}

/**
 * Hook to retrieve exchange rate loading status.
 */
export function useIsLoadingRates(): boolean {
  return useExchangeRateStore(selectIsLoadingRates);
}

/**
 * Hook to retrieve exchange rate error.
 */
export function useExchangeRateError(): ExchangeRateError | null {
  return useExchangeRateStore(selectExchangeRateError);
}

/**
 * Hook providing utility methods for rate conversions and mutations.
 */
export function useExchangeRateActions() {
  const setRate = useExchangeRateStore((state) => state.setRate);
  const setRates = useExchangeRateStore((state) => state.setRates);
  const setRateOptimistic = useExchangeRateStore((state) => state.setRateOptimistic);
  const rollbackOptimistic = useExchangeRateStore((state) => state.rollbackOptimistic);
  const confirmOptimistic = useExchangeRateStore((state) => state.confirmOptimistic);
  const setBaseCurrency = useExchangeRateStore((state) => state.setBaseCurrency);
  const convertAssetAmount = useExchangeRateStore((state) => state.convertAssetAmount);
  const isRateStale = useExchangeRateStore((state) => state.isRateStale);
  const reset = useExchangeRateStore((state) => state.reset);

  /**
   * Helper to perform an optimistic update wrapped in a promise execution with automatic rollback on error.
   */
  const mutateWithOptimism = useCallback(
    async <T,>(
      pair: string,
      optimisticRate: number,
      remoteOperation: () => Promise<T>,
    ): Promise<T> => {
      setRateOptimistic(pair, optimisticRate);
      try {
        const result = await remoteOperation();
        confirmOptimistic();
        return result;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Exchange rate update failed";
        rollbackOptimistic({
          message: errorMessage,
          timestamp: Date.now(),
        });
        throw err;
      }
    },
    [setRateOptimistic, confirmOptimistic, rollbackOptimistic],
  );

  return {
    setRate,
    setRates,
    setRateOptimistic,
    rollbackOptimistic,
    confirmOptimistic,
    mutateWithOptimism,
    setBaseCurrency,
    convertAssetAmount,
    isRateStale,
    reset,
  };
}
