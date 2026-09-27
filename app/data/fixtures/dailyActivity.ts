import type { WrapPeriod } from "@/app/store/wrapStore";
import { PERIODS } from "@/app/utils/indexer";

/** Synthetic daily activity for demo/mock flows when indexer data is unavailable. */
export function generateMockDailyActivity(
  totalTransactions: number,
  period: WrapPeriod = "monthly",
): Record<string, number> {
  const days = PERIODS[period] ?? 30;
  const activity: Record<string, number> = {};
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  let remaining = totalTransactions;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if (remaining <= 0) {
      activity[key] = 0;
      continue;
    }
    const maxForDay = Math.min(remaining, Math.ceil(totalTransactions / 8));
    const count =
      i === Math.floor(days * 0.7)
        ? Math.min(remaining, maxForDay + 5) // peak day
        : Math.floor(Math.random() * (maxForDay + 1));
    activity[key] = count;
    remaining -= count;
  }

  if (remaining > 0) {
    const lastKey = end.toISOString().split("T")[0];
    activity[lastKey] = (activity[lastKey] ?? 0) + remaining;
  }

  return activity;
}
