/**
 * Unit tests for wrapStore indexing persistence with account/network/period binding.
 *
 * Run with: jest app/store/__tests__/persistence.test.ts
 */

const PERSISTENCE_KEY = "stellar-wrap-indexing-state";

function createLocalStorage(initial: Record<string, string> = {}): Storage {
  const store: Record<string, string> = { ...initial };

  return {
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => delete store[key]);
    },
  } as Storage;
}

describe('wrapStore indexing persistence', () => {
  let localStorageMock: Storage;

  beforeEach(() => {
    localStorageMock = createLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorage(),
      writable: true,
    });
  });

  function buildPersistedState(overrides: {
    address?: string | null;
    network?: string;
    period?: string;
    timestamp?: number;
    currentStep?: string | null;
  } = {}) {
    return {
      currentStep: overrides.currentStep ?? 'fetching-transactions',
      completedSteps: 1,
      stepProgress: {
        initializing: 100,
        'fetching-transactions': 50,
        'filtering-timeframes': 0,
        'calculating-volume': 0,
        'identifying-assets': 0,
        'counting-contracts': 0,
        finalizing: 0,
      },
      overallProgress: 20,
      completedStepRecord: {
        initializing: true,
        'fetching-transactions': false,
        'filtering-timeframes': false,
        'calculating-volume': false,
        'identifying-assets': false,
        'counting-contracts': false,
        finalizing: false,
      },
      stepTimings: {
        initializing: 0,
        'fetching-transactions': 0,
        'filtering-timeframes': 0,
        'calculating-volume': 0,
        'identifying-assets': 0,
        'counting-contracts': 0,
        finalizing: 0,
      },
      startTime: Date.now(),
      timestamp: overrides.timestamp ?? Date.now(),
      address: overrides.address ?? 'GABCDEF123456789',
      network: overrides.network ?? 'mainnet',
      period: overrides.period ?? 'monthly',
    };
  }

  function saveState(state: unknown) {
    localStorageMock.setItem(PERSISTENCE_KEY, JSON.stringify(state));
  }

  it('ignores persisted state when address does not match', () => {
    const useWrapStore = require('@/app/store/wrapStore').useWrapStore;
    useWrapStore.getState().setAddress('GABCDEF123456789');
    useWrapStore.getState().setNetwork('mainnet');
    useWrapStore.getState().setPeriod('monthly');

    saveState(buildPersistedState({ address: 'GDIFFERENT...' }));

    const loaded = useWrapStore.getState().loadIndexingState();
    expect(loaded).toBe(false);
    expect(useWrapStore.getState().currentStep).toBeNull();
    expect(localStorageMock.getItem(PERSISTENCE_KEY)).toBeNull();
  });

  it('ignores persisted state when network does not match', () => {
    const useWrapStore = require('@/app/store/wrapStore').useWrapStore;
    useWrapStore.getState().setAddress('GABCDEF123456789');
    useWrapStore.getState().setNetwork('mainnet');
    useWrapStore.getState().setPeriod('monthly');

    saveState(buildPersistedState({ network: 'testnet' }));

    const loaded = useWrapStore.getState().loadIndexingState();
    expect(loaded).toBe(false);
    expect(useWrapStore.getState().currentStep).toBeNull();
    expect(localStorageMock.getItem(PERSISTENCE_KEY)).toBeNull();
  });

  it('ignores persisted state when period does not match', () => {
    const useWrapStore = require('@/app/store/wrapStore').useWrapStore;
    useWrapStore.getState().setAddress('GABCDEF123456789');
    useWrapStore.getState().setNetwork('mainnet');
    useWrapStore.getState().setPeriod('monthly');

    saveState(buildPersistedState({ period: 'weekly' }));

    const loaded = useWrapStore.getState().loadIndexingState();
    expect(loaded).toBe(false);
    expect(useWrapStore.getState().currentStep).toBeNull();
    expect(localStorageMock.getItem(PERSISTENCE_KEY)).toBeNull();
  });

  it('loads persisted state when address, network, and period all match', () => {
    const useWrapStore = require('@/app/store/wrapStore').useWrapStore;
    useWrapStore.getState().setAddress('GABCDEF123456789');
    useWrapStore.getState().setNetwork('mainnet');
    useWrapStore.getState().setPeriod('monthly');

    saveState(buildPersistedState());

    const loaded = useWrapStore.getState().loadIndexingState();
    expect(loaded).toBe(true);
    expect(useWrapStore.getState().currentStep).toBe('fetching-transactions');
    expect(useWrapStore.getState().overallProgress).toBe(20);
  });

  it('ignores persisted state when address is null in store but persisted has an address', () => {
    const useWrapStore = require('@/app/store/wrapStore').useWrapStore;
    useWrapStore.getState().setAddress(null);
    useWrapStore.getState().setNetwork('mainnet');
    useWrapStore.getState().setPeriod('monthly');

    saveState(buildPersistedState({ address: 'GABCDEF123456789' }));

    const loaded = useWrapStore.getState().loadIndexingState();
    expect(loaded).toBe(false);
  });

  it('ignores persisted state when timestamp is older than timeout', () => {
    const useWrapStore = require('@/app/store/wrapStore').useWrapStore;
    useWrapStore.getState().setAddress('GABCDEF123456789');
    useWrapStore.getState().setNetwork('mainnet');
    useWrapStore.getState().setPeriod('monthly');

    const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    saveState(buildPersistedState({ timestamp: oldTimestamp }));

    const loaded = useWrapStore.getState().loadIndexingState();
    expect(loaded).toBe(false);
    expect(localStorageMock.getItem(PERSISTENCE_KEY)).toBeNull();
  });
});
