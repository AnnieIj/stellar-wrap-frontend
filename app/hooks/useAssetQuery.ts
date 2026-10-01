"use client";

/**
 * useAssetQuery Hook
 *
 * Provides React Query-based caching for Stellar Asset metadata resolution.
 * Replaces manual useEffect + useState patterns with built-in caching,
 * retry logic, and stale-while-revalidate semantics.
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { AssetMetadata } from "@/app/types/asset";
import { resolveAsset } from "@/app/services/assetResolver";

/** Query key factory for consistent cache keys across the app. */
export const assetQueryKeys = {
  all: ["stellar-assets"] as const,
  detail: (code: string, issuer?: string) =>
    [...assetQueryKeys.all, code, issuer] as const,
};

/**
 * Query function that resolves a Stellar asset to its metadata.
 * Handles native assets (XLM) and issued assets uniformly.
 */
async function fetchAssetMetadata(
  code: string,
  issuer?: string,
): Promise<AssetMetadata> {
  return resolveAsset(code, issuer);
}

/**
 * Hook to fetch and cache a single Stellar asset's metadata.
 *
 * @param code - Asset code (e.g. "USDC", "XLM")
 * @param issuer - Optional issuer address for non-native assets
 * @param options - Additional query options
 * @returns UseQueryResult with AssetMetadata data
 */
export function useAssetQuery(
  code: string,
  issuer?: string,
): UseQueryResult<AssetMetadata, Error> {
  return useQuery<AssetMetadata, Error>({
    queryKey: assetQueryKeys.detail(code, issuer),
    queryFn: () => fetchAssetMetadata(code, issuer),
    // Cache asset metadata for 10 minutes — asset info rarely changes
    staleTime: 10 * 60 * 1000,
    // Keep in cache for 30 minutes after component unmounts
    gcTime: 30 * 60 * 1000,
    // Retry up to 2 times with exponential backoff for network issues
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    // Don't refetch on window focus for asset metadata (it's stable data)
    refetchOnWindowFocus: false,
    // Don't refetch on mount if data is fresh
    refetchOnMount: false,
    // Enable query only when code is provided
    enabled: !!code,
  });
}
