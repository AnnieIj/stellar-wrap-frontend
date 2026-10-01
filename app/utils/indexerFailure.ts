/**
 * Helpers for the loading screen's terminal-failure handling.
 *
 * Extracted from `app/loading/page.tsx` so the navigation decision can be unit
 * tested without rendering the page (the suite runs in a `node` environment with
 * no DOM). Previously the loading screen caught a fatal indexer error, set the
 * error state, and then navigated to /persona anyway - which rendered an empty
 * wrap and hid the real failure from the user.
 */

const DEFAULT_INDEXER_ERROR_MESSAGE = "Failed to load wrap data";

/**
 * Navigate onward only when we actually have something to show: either real
 * indexer output or the mock/cached fallback result. A null result means the
 * failure is unrecoverable for this attempt and the user must stay on the
 * error/retry UI.
 */
export function shouldNavigateToPersona<T>(
  result: T | null | undefined,
): result is T {
  return result !== null && result !== undefined;
}

/** Normalizes an unknown thrown value into a user-facing message. */
export function toIndexerErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return DEFAULT_INDEXER_ERROR_MESSAGE;
}
