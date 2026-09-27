/**
 * Track custom events with Plausible analytics
 * Events are only tracked if NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set
 */

export type PlausibleEventName =
  | 'wrap_started'
  | 'wrap_completed'
  | 'share_clicked'
  | 'share_completed'
  | 'share_cancelled';

interface PlausibleWindow extends Window {
  plausible?: (eventName: string, options?: Record<string, any>) => void;
}

export function trackEvent(eventName: PlausibleEventName, props?: Record<string, any>): void {
  if (typeof window === 'undefined') return;

  const plausible = (window as PlausibleWindow).plausible;
  if (!plausible) return;

  plausible(eventName, { props });
}
