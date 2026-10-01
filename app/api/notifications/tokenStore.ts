/**
 * In-memory store for single-use, channel-scoped unsubscribe tokens.
 *
 * Design decisions:
 * - Tokens are single-use: once consumed they are deleted immediately so they
 *   cannot be replayed.
 * - Tokens are channel-scoped: a token issued for "email" cannot be used to
 *   unsubscribe from "sms" and vice-versa.
 * - Tokens expire after TOKEN_TTL_MS (24 hours by default) to prevent stale
 *   tokens sitting in the store indefinitely.
 * - The store is module-level so it persists across requests within the same
 *   Node.js process (serverless cold-start resets it, which is acceptable for
 *   a notifications feature).
 *
 * In production you would replace this with a Redis/DynamoDB backed store;
 * the interface intentionally mirrors what that would look like.
 */

export type Channel = "email" | "sms" | "push";

export interface TokenRecord {
  walletAddress: string;
  channel: Channel;
  expiresAt: number; // Unix ms timestamp
}

/** Token time-to-live: 24 hours */
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// The backing map: token → record
const store = new Map<string, TokenRecord>();

/**
 * Persist a new token.  Overwrites any existing record for the same token
 * string (extremely unlikely with crypto-random tokens but safe to handle).
 */
export function saveToken(
  token: string,
  walletAddress: string,
  channel: Channel,
): void {
  store.set(token, {
    walletAddress,
    channel,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
}

/**
 * Consume a token in a single atomic lookup+delete.
 *
 * Returns the TokenRecord if the token exists, has not expired, and matches
 * the requested channel.  Returns `null` in every other case — callers MUST
 * treat a `null` return as an authentication failure.
 *
 * The token is deleted on the first call regardless of the channel check so
 * it cannot be probed for a valid channel by repeated attempts.
 */
export function consumeToken(
  token: string,
  channel: Channel,
): TokenRecord | null {
  const record = store.get(token);

  // Always delete on first look-up to prevent any replay
  store.delete(token);

  if (!record) return null;
  if (Date.now() > record.expiresAt) return null;
  if (record.channel !== channel) return null;

  return record;
}

/**
 * Check whether a token is present and valid without consuming it.
 * Useful in tests; not exposed in production routes.
 */
export function peekToken(token: string): TokenRecord | undefined {
  return store.get(token);
}

/**
 * Remove all expired tokens.  Call this periodically (e.g. from a cron
 * handler) to keep memory usage bounded.
 */
export function purgeExpiredTokens(): number {
  const now = Date.now();
  let removed = 0;
  for (const [token, record] of store.entries()) {
    if (now > record.expiresAt) {
      store.delete(token);
      removed++;
    }
  }
  return removed;
}

/** Exposed for tests only – clears the entire store. */
export function _clearStoreForTests(): void {
  store.clear();
}
