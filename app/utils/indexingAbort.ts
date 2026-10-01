/** Shared AbortController for in-flight Horizon indexing requests. */

let activeController: AbortController | null = null;

export function beginIndexingAbortScope(): AbortSignal {
  activeController?.abort();
  activeController = new AbortController();
  return activeController.signal;
}

export function abortIndexingRequests(): void {
  activeController?.abort();
  activeController = null;
}

export function getIndexingAbortSignal(): AbortSignal | undefined {
  return activeController?.signal;
}

export function clearIndexingAbortScope(): void {
  activeController = null;
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; message?: string };
  return (
    err.name === "AbortError" ||
    (typeof err.message === "string" && err.message.toLowerCase().includes("abort"))
  );
}
