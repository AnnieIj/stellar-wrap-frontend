/**
 * Type definitions for Stellar Wrap API request and response shapes.
 *
 * Used by both the frontend (typed fetch calls) and documentation tooling
 * (OpenAPI codegen, mock servers, etc.).
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Stellar public key — 56-character string starting with "G". */
export type StellarAddress = string;

/** Supported Stellar networks. */
export type Network = "mainnet" | "testnet";

/** Reporting period for wrap data. */
export type WrapPeriod = "weekly" | "monthly" | "yearly";

// ---------------------------------------------------------------------------
// GET /api/wrapped
// ---------------------------------------------------------------------------

/** Query parameters accepted by GET /api/wrapped. */
export interface WrappedRequestParams {
  /** Required. A valid Stellar public key (56 chars, starts with "G"). */
  accountId: StellarAddress;
  /** Optional. Defaults to "mainnet". */
  network?: Network;
  /** Optional. Defaults to "monthly". */
  period?: WrapPeriod;
}

/** A single dApp interaction entry returned by /api/wrapped. */
export interface WrappedDapp {
  name: string;
  transactions: number;
  color: string;
  gradient: string;
}

/** A single vibe entry returned by /api/wrapped. */
export interface WrappedVibe {
  type: string;
  percentage: number;
  color: string;
  label: string;
}

/** Successful 200 response body from GET /api/wrapped. */
export interface WrappedResponse {
  username: string;
  address: StellarAddress;
  totalTransactions: number;
  totalVolume: number;
  percentile: number;
  persona: string;
  personaDescription: string;
  dapps: WrappedDapp[];
  vibes: WrappedVibe[];
  /** True when this response was served from the 60-minute IndexedDB cache. */
  cached: boolean;
  /** ISO-8601 timestamp of when the cache entry was created, or null. */
  cacheTimestamp: string | null;
  /** True when a background re-index has been triggered for this address. */
  refreshingInBackground: boolean;
}

/** Error response body returned for 4xx / 5xx from GET /api/wrapped. */
export interface WrappedErrorResponse {
  error: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// GET /api/og
// ---------------------------------------------------------------------------

/** Query parameters accepted by GET /api/og. */
export interface OgRequestParams {
  /** Stellar username or truncated address shown on the card. Defaults to "StellarUser". */
  username?: string;
  /** Total transaction count displayed on the card. Defaults to "0". */
  transactions?: string;
  /** Persona / archetype label. Defaults to "Network Pioneer". */
  persona?: string;
  /** Top vibe label (e.g. "Steady", "Power User"). Defaults to "Steady". */
  topVibe?: string;
  /** Vibe percentage as a string (0–100). Defaults to "0". */
  vibePercentage?: string;
  /**
   * Path to the archetype image relative to the app's public directory.
   * Defaults to a slug derived from the persona name.
   * Example: "/archetypes/wizard.png"
   */
  archetypeImage?: string;
}

/**
 * The /api/og endpoint returns a binary PNG image (1200 × 1200 px), not JSON.
 * This type represents the HTTP response metadata.
 */
export interface OgResponseMeta {
  /** Always "image/png". */
  contentType: "image/png";
  /** Always 1200. */
  width: 1200;
  /** Always 1200. */
  height: 1200;
  /** Cache-Control header value set on the response. */
  cacheControl: string;
}
