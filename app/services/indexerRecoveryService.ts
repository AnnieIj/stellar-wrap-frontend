import { indexAccount } from "@/app/services/indexerService";
import { IndexerEventEmitter } from "@/app/utils/indexerEventEmitter";
import { STEP_ORDER, type IndexingStep } from "@/app/types/indexing";
import type { IndexerResult, WrapPeriod } from "@/app/utils/indexer";
import { indexerErrorLogger } from "@/app/utils/indexerErrorLogger";
import { useRateLimitStore } from "@/src/store/rateLimitStore";
import {
  backoffDelay,
  classifyError,
  isRetryable,
  makeInitialRecoveryState,
  MAX_RETRIES,
  type IndexerRecoveryState,
  type IndexerStepError,
  type StepRecoveryStatus,
} from "@/app/types/indexingRecovery";



export type RecoveryStateListener = (state: IndexerRecoveryState) => void;

interface RunOptions {
  accountId: string;
  network?: "mainnet" | "testnet";
  period?: WrapPeriod;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export class IndexerRecoveryService {
  private state: IndexerRecoveryState;
  private listeners = new Set<RecoveryStateListener>();

  private partialResults: Partial<Record<IndexingStep, unknown>> = {};

  constructor() {
    this.state = makeInitialRecoveryState();
  }

  subscribe(listener: RecoveryStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): IndexerRecoveryState {
    return { ...this.state };
  }

  getPartialResults(): Partial<Record<IndexingStep, unknown>> {
    return { ...this.partialResults };
  }

  private emit() {
    const snapshot = { ...this.state };
    this.listeners.forEach((l) => l(snapshot));
  }

  private patchStep(step: IndexingStep, patch: Partial<{ status: StepRecoveryStatus; error: IndexerStepError; completedAt: number }>) {
    this.state.stepStates[step] = { ...this.state.stepStates[step], ...patch };
    this.emit();
  }

  private reset(keepSessionId = false) {
    const id = keepSessionId ? this.state.sessionId : undefined;
    this.state = makeInitialRecoveryState(id);
    this.partialResults = {};
    this.emit();
  }

  private async runSingleStep(
    step: IndexingStep,
    opts: RunOptions,
    attempt = 1,
  ): Promise<boolean> {
    if (this.state.completedSteps.includes(step)) {
      this.patchStep(step, { status: "skipped" });
      return true;
    }

    this.patchStep(step, { status: "running" });

    try {
      await this.awaitStep(step, opts);

      this.state.completedSteps = [...this.state.completedSteps, step];
      this.patchStep(step, { status: "completed", completedAt: Date.now() });
      this.partialResults[step] = true; // mark presence; real data is in IndexerResult
      indexerErrorLogger.stepCompleted(step);
      return true;
    } catch (err) {
      const type = classifyError(err);
      const retryable = isRetryable(type);
      const stepError: IndexerStepError = {
        step,
        type,
        message: err instanceof Error ? err.message : String(err),
        retryable,
        timestamp: Date.now(),
        attempt,
      };

      indexerErrorLogger.stepFailed(stepError);
      this.patchStep(step, { status: "failed", error: stepError });

      if (retryable && attempt <= MAX_RETRIES) {
        const delay = backoffDelay(attempt);
        indexerErrorLogger.retryScheduled(step, attempt + 1, delay);
        this.state.totalRetries++;
        this.patchStep(step, { status: "running" }); // keep UI spinning
        this.emit();
        await sleep(delay);
        return this.runSingleStep(step, opts, attempt + 1);
      }

      // Exhausted retries or not retryable
      this.state.failedStep = step;
      this.state.isPartial = this.state.completedSteps.length > 0;
      this.emit();
      return false;
    }
  }


  private awaitStep(step: IndexingStep, _opts: RunOptions): Promise<void> {
    const emitter = IndexerEventEmitter.getInstance();

    return new Promise<void>((resolve, reject) => {
      const onComplete = (completedStep: IndexingStep) => {
        if (completedStep === step) {
          cleanup();
          resolve();
        }
      };

      const onError = (errorStep: IndexingStep, message: string) => {
        if (errorStep === step) {
          cleanup();
          reject(new Error(message));
        }
      };

      function cleanup() {
        emitter.off("stepComplete", onComplete);
        emitter.off("stepError", onError);
      }

      emitter.on("stepComplete", onComplete);
      emitter.on("stepError", onError);

      // Timeout guard (30 s per step)
      setTimeout(() => {
        cleanup();
        reject(new Error(`Step "${step}" timed out after 30s`));
      }, 30_000);
    });
  }

  private async runFrom(fromStep: IndexingStep, opts: RunOptions): Promise<IndexerResult | null> {
    const startIdx = STEP_ORDER.indexOf(fromStep);
    if (fromStep === "initializing") {
      this.launchIndexAccount(opts);
    }

    for (let i = startIdx; i < STEP_ORDER.length; i++) {
      const step = STEP_ORDER[i];
      const ok = await this.runSingleStep(step, opts);
      if (!ok) return null; // halted — user must choose recovery action
    }

    indexerErrorLogger.sessionComplete(
      this.state.sessionId,
      this.state.isPartial,
      this.state.totalRetries,
    );

    useRateLimitStore.getState().reset();

    return (this.partialResults["finalizing"] as IndexerResult) ?? null;
  }

  private launchIndexAccount(opts: RunOptions) {
    indexAccount(
      opts.accountId,
      opts.network ?? "mainnet",
      opts.period ?? "monthly",
    )
      .then((result) => {
        this.partialResults["finalizing"] = result;
      })
      .catch(() => {
        // Error is already surfaced via emitter → awaitStep → runSingleStep
      });
  }

  async start(opts: RunOptions): Promise<IndexerResult | null> {
    this.reset();
    this.state.pendingAction = null;
    this.emit();
    return this.runFrom("initializing", opts);
  }

  async retryFailedStep(opts: RunOptions): Promise<IndexerResult | null> {
    const failed = this.state.failedStep;
    if (!failed) return null;

    this.state.failedStep = null;
    this.state.pendingAction = "retry";
    this.patchStep(failed, { status: "idle", error: undefined });
    this.launchIndexAccount(opts);

    const ok = await this.runSingleStep(failed, opts);
    if (!ok) return null;

    const nextIdx = STEP_ORDER.indexOf(failed) + 1;
    if (nextIdx < STEP_ORDER.length) {
      return this.continueFrom(STEP_ORDER[nextIdx], opts);
    }

    useRateLimitStore.getState().reset();
    this.state.pendingAction = null;
    this.emit();
    return (this.partialResults["finalizing"] as IndexerResult) ?? null;
  }

  async resume(opts: RunOptions): Promise<IndexerResult | null> {
    const failed = this.state.failedStep;
    if (!failed) return null;

    indexerErrorLogger.resuming(failed, this.state.completedSteps);

    this.state.failedStep = null;
    this.state.pendingAction = "resume";
    this.patchStep(failed, { status: "idle", error: undefined });

    this.launchIndexAccount(opts);

    return this.continueFrom(failed, opts);
  }

  async restart(opts: RunOptions): Promise<IndexerResult | null> {
    this.reset();
    this.state.pendingAction = "restart";
    this.emit();
    return this.start(opts);
  }

  acceptPartialResults(): IndexerResult | null {
    return (this.partialResults["finalizing"] as IndexerResult) ?? null;
  }

  private async continueFrom(
    fromStep: IndexingStep,
    opts: RunOptions,
  ): Promise<IndexerResult | null> {
    for (
      let i = STEP_ORDER.indexOf(fromStep);
      i < STEP_ORDER.length;
      i++
    ) {
      const step = STEP_ORDER[i];
      const ok = await this.runSingleStep(step, opts);
      if (!ok) return null;
    }

    this.state.pendingAction = null;
    this.emit();

    indexerErrorLogger.sessionComplete(
      this.state.sessionId,
      this.state.isPartial,
      this.state.totalRetries,
    );

    useRateLimitStore.getState().reset();

    return (this.partialResults["finalizing"] as IndexerResult) ?? null;
  }
}

let _instance: IndexerRecoveryService | null = null;

export function getIndexerRecoveryService(): IndexerRecoveryService {
  if (!_instance) _instance = new IndexerRecoveryService();
  return _instance;
}

export function resetIndexerRecoveryService() {
  _instance = null;
}