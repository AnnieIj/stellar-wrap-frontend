/**
 * Push notification payload formatter.
 * Produces a branded PushPayload for each wrap period.
 */

import type { WrapPeriod } from "@/app/types/notifications";
import type { PushPayload } from "@/app/types/notifications";

/** Maps a WrapPeriod to its human-readable label used in notification copy. */
const PERIOD_LABEL: Record<WrapPeriod, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

/**
 * Returns a fully-populated {@link PushPayload} for the given wrap period.
 *
 * The payload shape is fixed per the design spec:
 * - `title`     – "Stellar Wrapped is ready! 🎉"
 * - `body`      – "Your [Period] wrap is ready. See what happened!"
 * - `icon`      – "/icon-192.png"
 * - `actionUrl` – "/connect?period=[period]"
 */
export function formatPushPayload(period: WrapPeriod): PushPayload {
  return {
    title: "Stellar Wrapped is ready! 🎉",
    body: `Your ${PERIOD_LABEL[period]} wrap is ready. See what happened!`,
    icon: "/icon-192.png",
    actionUrl: `/connect?period=${period}`,
  };
}
