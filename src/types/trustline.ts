/**
 * TypeScript type definitions for Stellar asset trustlines,
 * optimistic updates, and transaction lifecycle.
 */

import type { Network } from "../config";

export type TrustlineStatus = "pending" | "active" | "failed" | "reverting";

export interface TrustlineItem {
  /** Asset code (e.g. "USDC", "AQUA") */
  assetCode: string;
  /** Asset issuer account address (e.g. "GBBD47...") */
  assetIssuer: string;
  /** Decimal limit as string (e.g. "1000.0000000" or empty string / undefined for maximum limit) */
  limit?: string;
  /** Amount in 7-decimal integer Stroops */
  limitStroops?: bigint;
  /** Current lifecycle status */
  status: TrustlineStatus;
  /** Whether this entry was optimistically added before confirmation */
  optimistic: boolean;
  /** Creation timestamp in milliseconds */
  createdAt: number;
  /** Confirmed transaction hash if finalized */
  transactionHash?: string;
  /** User-friendly error message if the trustline creation failed */
  error?: string;
}

export interface CreateTrustlineParams {
  accountAddress: string;
  assetCode: string;
  assetIssuer: string;
  /** Optional custom limit. If omitted, maximum Stellar limit is used. */
  limit?: string;
  network: Network;
}

export interface TrustlineResult {
  transactionHash: string;
  ledger?: number;
  assetCode: string;
  assetIssuer: string;
}
