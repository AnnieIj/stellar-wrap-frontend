/**
 * @file app/api/notifications/_lib/kv.ts
 *
 * Single storage module for the notifications subsystem.
 *
 * ## Design
 * This module imports the shared KV storage client directly from the root
 * `_lib/kv` rather than re-exporting it through a second surface.  Doing so
 * makes it unambiguous which layer owns the connection, the error handling,
 * and the serialization.
 *
 * Nothing outside this file should import from `app/api/_lib/kv` for
 * notification-related work.  All notification routes import from here.
 *
 * ---
 *
 * ## Key namespace
 *
 * Every key used by the notifications subsystem lives in one of three
 * families, all prefixed with `notif:` to guarantee no collisions with other
 * subsystems sharing the same KV store.
 *
 * | Family          | Pattern                                             | Owner                                        | Description                                                                                                                                                                      |
 * |-----------------|-----------------------------------------------------|----------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
 * | `notif:sub:`    | `notif:sub:<walletAddress>`                         | subscribe / unsubscribe / preferences / data | One `SubscriptionRecord` per wallet. Contains push subscription JSON, email address, channel period preferences, consent flags, and optionally a deletion timestamp.             |
 * | `notif:period:` | `notif:period:<period>`                             | subscribe / unsubscribe                      | A set of wallet addresses opted in to `period`. Used by dispatch to fan out without a full scan when only one period is active.                                                  |
 * | `notif:log:`    | `notif:log:<wallet>:<channel>:<period>:<periodKey>` | dispatch                                     | Idempotency log. One `DispatchLogEntry` per (wallet, channel, period, periodKey) tuple. Prevents double-sending within the same period window.                                   |
 *
 * ---
 *
 * ## Failure modes
 *
 * KV operations can fail for several reasons: network partition, Vercel KV
 * quota exhausted, or a transient Redis error.  Each caller has a defined
 * contract for how it handles those failures:
 *
 * | Caller                          | Mode        | Meaning                                                                                                     |
 * |---------------------------------|-------------|-------------------------------------------------------------------------------------------------------------|
 * | `dispatch` (fan-out loop)       | **LOUD**    | A KV error propagates and is caught by the top-level handler, returning 500 so the cron job can retry.     |
 * | `subscribe`                     | **LOUD**    | A failed write means the subscription was not persisted. The client retries.                                |
 * | `subscribe-email`               | **LOUD**    | A failed write means no confirmation email will be sent. Error propagates.                                  |
 * | `confirm-email`                 | **LOUD**    | Cannot confirm without writing the updated status. Failure propagates.                                      |
 * | `preferences/{wallet}` GET      | **DEGRADE** | Returns 404 if the record is missing; transient KV errors surface as 500 via `internalApiError`.            |
 * | `preferences/{wallet}` PUT      | **LOUD**    | A write failure means the change was not saved. Error propagates.                                           |
 * | `unsubscribe`                   | **LOUD**    | Must write the updated record. Error propagates.                                                            |
 * | `data/{wallet}` DELETE          | **LOUD**    | GDPR deletion must complete reliably. Error propagates.                                                     |
 *
 * Callers that should fail loudly let exceptions bubble to `internalApiError`.
 * Callers that may degrade catch KV errors explicitly and return a graceful
 * fallback — see the `// KV_FAILURE: DEGRADE` annotations in those routes.
 */

// ─── Storage client ───────────────────────────────────────────────────────────
//
// Import the storage helpers directly from the root client.
// Route files import from this module only — never from ../../_lib/kv.

export {
  kvGet,
  kvSet,
  kvDel,
  kvKeys,
  kvSAdd,
  kvSRem,
  kvReset,
} from "../../_lib/kv";

// ─── Failure-mode markers ─────────────────────────────────────────────────────
//
// Attach as inline comments on every KV call site to make the failure contract
// visible without opening this file:
//
//   // KV_FAILURE: LOUD
//   await kvSet(SUB_KEY(wallet), record);
//
//   // KV_FAILURE: DEGRADE — return cached/empty data instead of 500
//   const record = await kvGet<SubscriptionRecord>(SUB_KEY(wallet));

/** A KV failure propagates as a 500 error so the caller can retry. */
export const KV_FAILURE_LOUD = "LOUD" as const;

/**
 * A KV failure is caught and a graceful fallback is returned instead of 500.
 * Annotate call sites with `// KV_FAILURE: DEGRADE`.
 */
export const KV_FAILURE_DEGRADE = "DEGRADE" as const;

export type KvFailureMode = typeof KV_FAILURE_LOUD | typeof KV_FAILURE_DEGRADE;

// ─── Key namespace ────────────────────────────────────────────────────────────

/**
 * Subscription record key.
 *
 * One `SubscriptionRecord` stored per wallet address.
 * Holds push-subscription JSON, email details, per-channel period preferences,
 * consent metadata, and an optional `deletionRequested` timestamp.
 *
 * Pattern: `notif:sub:<walletAddress>`
 *
 * Writers: **LOUD** — a failed write means the record was not persisted.
 * Readers (preferences GET): **DEGRADE** — return 404 on miss rather than
 * propagating a transient KV error.
 */
export const SUB_KEY = (wallet: string): string => `notif:sub:${wallet}`;

/**
 * Period subscriber-set key.
 *
 * Stores the set of wallet addresses opted in to a given `WrapPeriod`.
 * Used by dispatch to look up recipients for one period without scanning the
 * entire `notif:sub:*` keyspace.
 *
 * Pattern: `notif:period:<period>`
 *   where `<period>` ∈ `{ "weekly" | "monthly" | "yearly" }`
 *
 * Failure mode: **LOUD** — a missed index update would cause silent delivery
 * gaps or phantom entries.
 */
export const PERIOD_KEY = (period: string): string => `notif:period:${period}`;

/**
 * Dispatch idempotency-log key.
 *
 * One `DispatchLogEntry` per (wallet, channel, period, periodKey) tuple.
 * Dispatch checks this key before sending and writes it afterwards, ensuring
 * each notification is sent at most once per period window regardless of how
 * many times the cron job fires.
 *
 * Pattern: `notif:log:<wallet>:<channel>:<period>:<periodKey>`
 *   e.g.   `notif:log:GABC…:email:monthly:2026-09`
 *
 * Failure mode: **LOUD** — if the log entry cannot be read or written the
 * dispatch handler propagates the error so the cron job retries the whole run
 * rather than risking a double-send.
 */
export const LOG_KEY = (
  wallet: string,
  channel: string,
  period: string,
  periodKey: string,
): string => `notif:log:${wallet}:${channel}:${period}:${periodKey}`;
