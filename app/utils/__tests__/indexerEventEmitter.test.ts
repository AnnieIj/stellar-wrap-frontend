import { beforeEach, describe, expect, it, vi } from "vitest";

const setCurrentStep = vi.fn();
const setStepProgress = vi.fn();
const completeStep = vi.fn();
const setIndexingError = vi.fn();
const clearPersistedIndexingState = vi.fn();
const cancelIndexing = vi.fn();

vi.mock("@/app/store/wrapStore", () => ({
  useWrapStore: {
    getState: () => ({
      setCurrentStep,
      setStepProgress,
      completeStep,
      setIndexingError,
      clearPersistedIndexingState,
      cancelIndexing,
    }),
  },
}));

describe("IndexerEventEmitter singleton lifecycle", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const { IndexerEventEmitter } = await import(
      "@/app/utils/indexerEventEmitter"
    );
    IndexerEventEmitter.getInstance().reset();
  });

  it("connect → reset → connect registers listeners only once per session", async () => {
    const { IndexerEventEmitter } = await import(
      "@/app/utils/indexerEventEmitter"
    );
    const emitter = IndexerEventEmitter.getInstance();

    emitter.connectToStore();
    emitter.connectToStore(); // duplicate call must be a no-op
    expect(emitter.listenerCount("step-change")).toBe(1);

    emitter.emitStepChange("initializing");
    expect(setCurrentStep).toHaveBeenCalledTimes(1);
    expect(setCurrentStep).toHaveBeenCalledWith("initializing");

    emitter.reset();
    expect(emitter.listenerCount("step-change")).toBe(0);

    // Stale session: events after reset must not update the store
    emitter.emitStepChange("fetching-transactions");
    expect(setCurrentStep).toHaveBeenCalledTimes(1);

    emitter.connectToStore();
    expect(emitter.listenerCount("step-change")).toBe(1);

    emitter.emitStepChange("finalizing");
    expect(setCurrentStep).toHaveBeenCalledTimes(2);
    expect(setCurrentStep).toHaveBeenLastCalledWith("finalizing");
  });

  it("emits exactly one store update per indexing event after reconnect", async () => {
    const { IndexerEventEmitter } = await import(
      "@/app/utils/indexerEventEmitter"
    );
    const emitter = IndexerEventEmitter.getInstance();

    emitter.connectToStore();
    emitter.reset();
    emitter.connectToStore();

    emitter.emitStepProgress("calculating-volume", 40);
    emitter.emitStepComplete("calculating-volume");

    expect(setStepProgress).toHaveBeenCalledTimes(1);
    expect(setStepProgress).toHaveBeenCalledWith("calculating-volume", 40);
    expect(completeStep).toHaveBeenCalledTimes(1);
    expect(completeStep).toHaveBeenCalledWith("calculating-volume");
  });

  it("disconnectFromStore clears listeners the same way as reset", async () => {
    const { IndexerEventEmitter } = await import(
      "@/app/utils/indexerEventEmitter"
    );
    const emitter = IndexerEventEmitter.getInstance();

    emitter.connectToStore();
    emitter.disconnectFromStore();
    expect(emitter.listenerCount("step-progress")).toBe(0);

    emitter.connectToStore();
    emitter.emitStepProgress("identifying-assets", 10);
    expect(setStepProgress).toHaveBeenCalledTimes(1);
  });
});
