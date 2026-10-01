/**
 * Demo mode fixture.
 *
 * The previous placeholder ("GDEMOADDRESS...") was only 46 characters and had no
 * valid strkey checksum, so it failed address validation and, if it ever reached
 * the indexer, would have produced a bogus Horizon request. This is the same
 * valid Ed25519 public key already used as `validGAddr` across the test suite.
 *
 * Demo mode is mock-only: the loading screen detects it via `isDemoMode()` and
 * serves generated wrap data instead of querying Horizon.
 */
export const DEMO_STELLAR_ADDRESS =
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

const DEMO_MODE_STORAGE_KEY = "stellarWrap:demoMode";

export function markDemoMode(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DEMO_MODE_STORAGE_KEY, "true");
}

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(DEMO_MODE_STORAGE_KEY) === "true";
}

export function clearDemoMode(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
}
