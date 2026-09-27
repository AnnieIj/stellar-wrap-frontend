/**
 * KV storage abstraction for notification data.
 * Re-exports the shared KV storage abstraction.
 */

export * from "../../_lib/kv";

export const SUB_KEY = (wallet: string) => `notif:sub:${wallet}`;
export const PERIOD_KEY = (period: string) => `notif:period:${period}`;
export const LOG_KEY = (wallet: string, channel: string, period: string, periodKey: string) =>
  `notif:log:${wallet}:${channel}:${period}:${periodKey}`;
