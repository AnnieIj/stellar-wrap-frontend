/**
 * Unsubscribe token generator.
 *
 * Uses `crypto.randomUUID()` which is available in:
 *   - Node.js ≥ 15.6 (used in API routes)
 *   - All modern browsers (Web Crypto API)
 *   - The `lib: ["dom", "dom.iterable", "esnext"]` TypeScript config in this project
 */

/**
 * Generates a cryptographically random UUID (v4) string suitable for use as
 * an unsubscribe or email-confirmation token.
 *
 * @returns A UUID v4 string, e.g. `"110e8400-e29b-41d4-a716-446655440000"`.
 */
export function generateUnsubscribeToken(): string {
  return crypto.randomUUID();
}
