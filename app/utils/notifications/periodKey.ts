/**
 * Period key derivation and active-period detection utilities.
 */

import type { WrapPeriod } from "@/app/types/notifications";

/**
 * Returns the ISO week number (1–53) for a given UTC date.
 * Uses the ISO 8601 definition: week 1 is the week containing the first Thursday.
 */
function getISOWeek(date: Date): number {
  // Work with a copy set to the nearest Thursday of the week (ISO week definition)
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // ISO day-of-week: Monday=1 … Sunday=7
  const dayOfWeek = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  // Move to the Thursday of the same ISO week
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return weekNumber;
}

/**
 * Derives the period key string for a given wrap period and reference date.
 *
 * - `weekly`  → `YYYY-Www`  (e.g. "2025-W03")
 * - `monthly` → `YYYY-MM`   (e.g. "2025-01")
 * - `yearly`  → `YYYY`      (e.g. "2025")
 *
 * All calculations use UTC to remain consistent with the dispatch boundary checks.
 */
export function getPeriodKey(period: WrapPeriod, now: Date): string {
  switch (period) {
    case "weekly":
      return `${now.getUTCFullYear()}-W${getISOWeek(now).toString().padStart(2, "0")}`;
    case "monthly":
      return `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, "0")}`;
    case "yearly":
      return `${now.getUTCFullYear()}`;
  }
}

/**
 * Determines which wrap periods are "active" at the given UTC moment — i.e.
 * which period boundaries have just been crossed within the current UTC hour
 * (the dispatch cron runs hourly, so we check whether `now` falls within the
 * first 60 minutes of a period boundary).
 *
 * Boundary definitions (all UTC):
 * - `weekly`  → Monday,    00:00 – 00:59
 * - `monthly` → 1st of the month, 00:00 – 00:59
 * - `yearly`  → 1 January, 00:00 – 00:59
 */
export function getActivePeriodsForNow(now: Date): WrapPeriod[] {
  const active: WrapPeriod[] = [];

  const hour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const dayOfMonth = now.getUTCDate(); // 1-indexed
  const month = now.getUTCMonth(); // 0-indexed

  // Weekly: first hour of Monday UTC
  if (hour === 0 && dayOfWeek === 1) {
    active.push("weekly");
  }

  // Monthly: first hour of the 1st day of any month
  if (hour === 0 && dayOfMonth === 1) {
    active.push("monthly");
  }

  // Yearly: first hour of 1 January
  if (hour === 0 && dayOfMonth === 1 && month === 0) {
    active.push("yearly");
  }

  return active;
}
