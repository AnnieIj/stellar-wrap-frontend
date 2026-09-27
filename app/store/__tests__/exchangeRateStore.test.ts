import { useExchangeRateStore, DEFAULT_RATES } from "../exchangeRateStore";

describe("exchangeRateStore", () => {
  beforeEach(() => {
    useExchangeRateStore.getState().reset();
  });

  it("initializes with default exchange rates", () => {
    const state = useExchangeRateStore.getState();
    expect(state.rates["XLM/USD"].rate).toBe(0.12);
    expect(state.rates["USDC/USD"].rate).toBe(1.0);
    expect(state.baseCurrency).toBe("USD");
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("updates a single exchange rate with normalized pair key", () => {
    useExchangeRateStore.getState().setRate("xlm/usd", 0.15, "coinbase");
    const state = useExchangeRateStore.getState();
    expect(state.rates["XLM/USD"].rate).toBe(0.15);
    expect(state.rates["XLM/USD"].source).toBe("coinbase");
    expect(state.rates["XLM/USD"].lastUpdated).toBeGreaterThan(0);
  });

  it("updates multiple exchange rates in bulk", () => {
    useExchangeRateStore.getState().setRates({
      "XLM/USD": 0.18,
      "EURC/USD": 1.08,
    });
    const state = useExchangeRateStore.getState();
    expect(state.rates["XLM/USD"].rate).toBe(0.18);
    expect(state.rates["EURC/USD"].rate).toBe(1.08);
  });

  it("converts asset amounts to base currency correctly", () => {
    useExchangeRateStore.getState().setRate("XLM/USD", 0.2);
    const converted = useExchangeRateStore.getState().convertAssetAmount(50, "XLM");
    expect(converted).toBe(10); // 50 * 0.2 = 10

    // Same as base currency should return direct amount
    const sameCurrency = useExchangeRateStore.getState().convertAssetAmount(100, "USD");
    expect(sameCurrency).toBe(100);

    // Unknown asset returns null
    const unknown = useExchangeRateStore.getState().convertAssetAmount(10, "UNKNOWN");
    expect(unknown).toBeNull();
  });

  it("handles optimistic update and confirmation correctly", () => {
    const initialRate = useExchangeRateStore.getState().rates["XLM/USD"].rate;
    expect(initialRate).toBe(0.12);

    // Perform optimistic update
    useExchangeRateStore.getState().setRateOptimistic("XLM/USD", 0.25);
    expect(useExchangeRateStore.getState().rates["XLM/USD"].rate).toBe(0.25);
    expect(useExchangeRateStore.getState().rollbackSnapshot).toBeDefined();

    // Confirm optimistic update
    useExchangeRateStore.getState().confirmOptimistic();
    expect(useExchangeRateStore.getState().rates["XLM/USD"].rate).toBe(0.25);
    expect(useExchangeRateStore.getState().rollbackSnapshot).toBeNull();
  });

  it("handles optimistic update rollback on failure", () => {
    const initialRate = useExchangeRateStore.getState().rates["XLM/USD"].rate;
    expect(initialRate).toBe(0.12);

    // Perform optimistic update
    useExchangeRateStore.getState().setRateOptimistic("XLM/USD", 0.35);
    expect(useExchangeRateStore.getState().rates["XLM/USD"].rate).toBe(0.35);

    // Rollback
    useExchangeRateStore.getState().rollbackOptimistic({
      message: "Network request timed out",
      timestamp: Date.now(),
    });

    const state = useExchangeRateStore.getState();
    expect(state.rates["XLM/USD"].rate).toBe(0.12);
    expect(state.rollbackSnapshot).toBeNull();
    expect(state.error?.message).toBe("Network request timed out");
  });

  it("detects stale rates according to TTL", () => {
    const store = useExchangeRateStore.getState();
    // Default lastUpdated is 0, so should be stale
    expect(store.isRateStale("XLM/USD")).toBe(true);

    // Freshly updated rate should not be stale
    store.setRate("XLM/USD", 0.14);
    expect(useExchangeRateStore.getState().isRateStale("XLM/USD")).toBe(false);
  });

  it("resets store to initial state", () => {
    useExchangeRateStore.getState().setRate("XLM/USD", 0.99);
    useExchangeRateStore.getState().setBaseCurrency("EUR");
    useExchangeRateStore.getState().reset();

    const state = useExchangeRateStore.getState();
    expect(state.rates["XLM/USD"].rate).toBe(DEFAULT_RATES["XLM/USD"].rate);
    expect(state.baseCurrency).toBe("USD");
  });
});
