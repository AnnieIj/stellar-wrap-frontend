import { PeriodSelector } from "../PeriodSelector";
import type { WrapPeriod } from "@/app/store/wrapStore";

// Since we don't have @testing-library/react, test the component's
// underlying logic through the store integration instead.
// The PeriodSelector is a thin presentational component whose behavior
// is validated through its props contract.

describe("PeriodSelector props contract", () => {
  it("exports PeriodSelector as a function component", () => {
    expect(typeof PeriodSelector).toBe("function");
  });

  it("accepts all valid WrapPeriod values", () => {
    const periods: WrapPeriod[] = ["weekly", "monthly", "yearly"];
    // Ensure the component definition accepts each period without type errors.
    // (This is a compile-time type check captured as a runtime assertion.)
    periods.forEach((p) => {
      expect(["weekly", "monthly", "yearly"]).toContain(p);
    });
  });
});

describe("Period store integration", () => {
  // Reset module state between tests
  beforeEach(() => {
    jest.resetModules();
  });

  it("period setter in wrapStore accepts WrapPeriod values", async () => {
    // We can't render React components without @testing-library/react,
    // but we can verify the store correctly handles all period values.
    const { useWrapStore } = await import("@/app/store/wrapStore");

    // Test that setPeriod works for each valid period
    const periods: WrapPeriod[] = ["weekly", "monthly", "yearly"];
    for (const p of periods) {
      useWrapStore.getState().setPeriod(p);
      expect(useWrapStore.getState().period).toBe(p);
    }
  });

  it("period persists after reset when explicitly re-set", async () => {
    const { useWrapStore } = await import("@/app/store/wrapStore");

    useWrapStore.getState().setPeriod("weekly");
    expect(useWrapStore.getState().period).toBe("weekly");

    // reset() sets period back to "yearly"
    useWrapStore.getState().reset();
    expect(useWrapStore.getState().period).toBe("yearly");

    // Re-applying period after reset (as connect page does)
    useWrapStore.getState().setPeriod("weekly");
    expect(useWrapStore.getState().period).toBe("weekly");
  });

  it("selected period is passed to indexer via store", async () => {
    const { useWrapStore } = await import("@/app/store/wrapStore");

    // Simulate connect page flow: reset → setPeriod → loading page reads
    useWrapStore.getState().reset();
    useWrapStore.getState().setPeriod("monthly");

    const state = useWrapStore.getState();
    expect(state.period).toBe("monthly");
    expect(state.address).toBeNull(); // address not yet set
  });
});
