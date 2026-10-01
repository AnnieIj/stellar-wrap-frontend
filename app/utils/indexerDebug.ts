/**
 * Dev-only logger for indexing / loading flows.
 * Delegates to the central logger module while preserving indexer namespace.
 */

import { logger } from "./logger";

const indexerLogger = logger.child("Indexer");

export function indexerDebug(...args: unknown[]): void {
  indexerLogger.debug(...args);
}

export function indexerWarn(...args: unknown[]): void {
  indexerLogger.warn(...args);
}

/** Errors without PII — never include account IDs in the message. */
export function indexerError(message: string, error?: unknown): void {
  indexerLogger.error(message, error);
}
