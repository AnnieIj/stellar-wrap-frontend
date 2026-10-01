import type { PersistedIndexingState } from "@/app/types/indexing";

const PERSISTENCE_KEY = "stellar-wrap-indexing-state";
const PERSISTENCE_TIMEOUT = 5 * 60 * 1000;

function buildPersistedState(
  overrides: Partial<PersistedIndexingState> = {},
): PersistedIndexingState {
  return {
    currentStep: "fetching-transactions",
    completedSteps: 2,
    stepProgress: {
      initializing: 100,
      "fetching-transactions": 50,
      "filtering-timeframes": 0,
      "calculating-volume": 0,
      "identifying-assets": 0,
      "counting-contracts": 0,
      finalizing: 0,
    },
    overallProgress: 30,
    completedStepRecord: {
      initializing: true,
      "fetching-transactions": false,
      "filtering-timeframes": false,
      "calculating-volume": false,
      "identifying-assets": false,
      "counting-contracts": false,
      finalizing: false,
    },
    stepTimings: {
      initializing: 500,
      "fetching-transactions": 0,
      "filtering-timeframes": 0,
      "calculating-volume": 0,
      "identifying-assets": 0,
      "counting-contracts": 0,
      finalizing: 0,
    },
    startTime: Date.now() - 60_000,
    timestamp: Date.now(),
    address: "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ",
    network: "mainnet",
    period: "monthly",
    ...overrides,
  };
}

// Mock localStorage and window for Node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Define window and localStorage for Node environment
Object.defineProperty(globalThis, "window", {
  value: globalThis,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Import after window/localStorage are defined
import {
  peekPersistedState,
} from "../ProgressRecoveryBanner";

describe("peekPersistedState", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(peekPersistedState()).toBeNull();
  });

  it("returns null when stored value is invalid JSON", () => {
    localStorageMock.setItem(PERSISTENCE_KEY, "not-json{{{");
    expect(peekPersistedState()).toBeNull();
  });

  it('returns "resumable" for fresh state within timeout', () => {
    const state = buildPersistedState({ timestamp: Date.now() });
    localStorageMock.setItem(PERSISTENCE_KEY, JSON.stringify(state));

    const snapshot = peekPersistedState();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.status).toBe("resumable");
    expect(snapshot!.state.overallProgress).toBe(30);
    expect(snapshot!.ageMs).toBeLessThan(PERSISTENCE_TIMEOUT);
  });

  it('returns "expired" for state older than timeout', () => {
    const state = buildPersistedState({
      timestamp: Date.now() - PERSISTENCE_TIMEOUT - 1000,
    });
    localStorageMock.setItem(PERSISTENCE_KEY, JSON.stringify(state));

    const snapshot = peekPersistedState();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.status).toBe("expired");
    expect(snapshot!.ageMs).toBeGreaterThan(PERSISTENCE_TIMEOUT);
  });

  it("preserves address from persisted state", () => {
    const state = buildPersistedState({
      address: "GTEST123456789012345678901234567890123456789012345",
    });
    localStorageMock.setItem(PERSISTENCE_KEY, JSON.stringify(state));

    const snapshot = peekPersistedState();
    expect(snapshot!.state.address).toBe(
      "GTEST123456789012345678901234567890123456789012345",
    );
  });

  it("preserves network from persisted state", () => {
    const state = buildPersistedState({ network: "testnet" });
    localStorageMock.setItem(PERSISTENCE_KEY, JSON.stringify(state));

    const snapshot = peekPersistedState();
    expect(snapshot!.state.network).toBe("testnet");
  });

  it("preserves period from persisted state", () => {
    const state = buildPersistedState({ period: "weekly" });
    localStorageMock.setItem(PERSISTENCE_KEY, JSON.stringify(state));

    const snapshot = peekPersistedState();
    expect(snapshot!.state.period).toBe("weekly");
  });
});

describe("ProgressRecoveryBanner component", () => {
  it("exports ProgressRecoveryBanner as a function component", async () => {
    const mod = await import("../ProgressRecoveryBanner");
    expect(typeof mod.ProgressRecoveryBanner).toBe("function");
  });
});

describe("wrapStore clearPersistedIndexingState", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("removes persisted state from localStorage", async () => {
    const state = buildPersistedState();
    localStorageMock.setItem(PERSISTENCE_KEY, JSON.stringify(state));
    expect(localStorageMock.getItem(PERSISTENCE_KEY)).not.toBeNull();

    const { useWrapStore } = await import("@/app/store/wrapStore");
    useWrapStore.getState().clearPersistedIndexingState();

    expect(localStorageMock.getItem(PERSISTENCE_KEY)).toBeNull();
  });
});
