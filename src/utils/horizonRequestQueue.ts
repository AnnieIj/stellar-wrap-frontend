import { parseHorizonError, StructuredHorizonError } from './horizonErrorHandler';
import { useRateLimitStore } from '../store/rateLimitStore';
import { logger } from '../../app/utils/logger';

const log = logger.child('horizonRequestQueue');

type RequestFn<T> = () => Promise<T>;

interface QueueItem<T> {
    request: RequestFn<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
    attempts: number;
}

export class HorizonRequestQueue {
    private queue: QueueItem<unknown>[] = [];
    private processing = false;
    private maxAttempts = 5;
    private initialBackoff = 1000; // 1 s
    private rateLimitReset: number | null = null;
    private isRateLimited = false;

    constructor(private maxConcurrency: number = 2) {}

    async enqueue<T>(request: RequestFn<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            // Cast to unknown-based item so it can join the shared queue
            (this.queue as QueueItem<T>[]).push({
                request,
                resolve,
                reject,
                attempts: 0,
            });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.processing || this.queue.length === 0) return;

        // Check global rate limit
        if (this.isRateLimited && this.rateLimitReset) {
            const now = Date.now();
            if (now < this.rateLimitReset) {
                const waitTime = this.rateLimitReset - now;
                useRateLimitStore.getState().setRateLimited(true, this.rateLimitReset);
                setTimeout(() => this.processQueue(), waitTime + 100);
                return;
            } else {
                this.isRateLimited = false;
                this.rateLimitReset = null;
                useRateLimitStore.getState().setRateLimited(false, null);
            }
        }

        this.processing = true;

        const batchSize = Math.min(this.queue.length, this.maxConcurrency);
        const batch = this.queue.splice(0, batchSize);

        await Promise.all(batch.map((item) => this.executeRequest(item)));

        this.processing = false;

        if (this.queue.length > 0) {
            this.processQueue();
        }
    }

    private async executeRequest(item: QueueItem<unknown>) {
        try {
            const result = await item.request();
            item.resolve(result);
        } catch (error) {
            const structuredError = await parseHorizonError(error);

            if (structuredError.isRetryable && item.attempts < this.maxAttempts) {
                item.attempts++;

                if (structuredError.type === 'RATE_LIMIT' && structuredError.rateLimit) {
                    this.handleRateLimit(structuredError);
                }

                const delay = this.calculateBackoff(item.attempts, structuredError);
                useRateLimitStore.getState().setRetryAttempt(item.attempts);
                useRateLimitStore
                    .getState()
                    .setMessage(`Retrying in ${Math.ceil(delay / 1000)}s...`);

                log.warn(
                    `Retrying Horizon request (attempt ${item.attempts}) in ${delay}ms: ${structuredError.message}`,
                );

                setTimeout(() => {
                    this.queue.push(item);
                    this.processQueue();
                }, delay);
            } else {
                useRateLimitStore.getState().setMessage(null);
                item.reject(structuredError);
            }
        }
    }

    private handleRateLimit(error: StructuredHorizonError) {
        if (error.rateLimit) {
            this.rateLimitReset = error.rateLimit.reset * 1000;
            this.isRateLimited = true;

            const waitTime = Math.max(0, this.rateLimitReset - Date.now());
            console.error(
                `Horizon rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s until reset.`,
            );
        }
    }

    private calculateBackoff(attempts: number, error: StructuredHorizonError): number {
        if (error.rateLimit?.retryAfterSeconds) {
            return error.rateLimit.retryAfterSeconds * 1000;
        }
        return Math.pow(2, attempts - 1) * this.initialBackoff;
    }

    clear() {
        this.queue.forEach((item) => item.reject(new Error('Queue cleared')));
        this.queue = [];
        this.isRateLimited = false;
        this.rateLimitReset = null;
    }
}

// Singleton instance
export const horizonQueue = new HorizonRequestQueue(2);