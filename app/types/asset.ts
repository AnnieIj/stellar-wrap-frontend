/**
 
 * Asset type definitions for Stellar wrap
*/

/*
 * Represents resolved asset metadata
 */
export type AssetMetadata = {
  code: string;
  issuer?: string;
  name: string;
  domain?: string;
  description?: string;
  isNative: boolean;
} & (
  | { logo?: undefined; logoAlt?: undefined }
  | { logo: string; logoAlt: string }
);

/*
 * Asset cache entry with expiration
 */
export interface AssetCacheEntry {
  metadata: AssetMetadata;
  timestamp: number;
  ttl: number; // in milliseconds 
  /** Bumped when issuer metadata schema changes; mismatched entries are dropped. */
  version: number;
}

/**
 * Asset cache store
 */
export interface AssetCache {
  [key: string]: AssetCacheEntry;
}

/**
 * Stellar asset without metadata
 */
export interface RawAsset {
  code: string;
  issuer?: string;
}

/**
 * Result of asset resolution
 */
export interface AssetResolutionResult {
  success: boolean;
  metadata?: AssetMetadata;
  error?: string;
}

/**
 * Variants for the AssetCard component, used for Storybook stories.
 */
export type AssetCardVariant = 'primary' | 'secondary' | 'disabled' | 'loading';