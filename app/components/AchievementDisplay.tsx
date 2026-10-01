"use client";

/**
 * AchievementDisplay Component
 * Displays achievement metrics with resolved asset metadata
 * Integrates with asset resolver to show proper asset names and logos
 */

import React from "react";
import { IndexerResult } from "@/app/utils/indexer";
import { useAssetQuery } from "@/app/hooks/useAssetQuery";
import { AssetDisplay, AssetBadge } from "./AssetDisplay";
import { Sparkles } from "lucide-react";
import { logger } from "@/app/utils/logger";

const log = logger.child("AchievementDisplay");

interface AchievementDisplayProps {
  result: IndexerResult | null;
  loading?: boolean;
}

/**
 * Component that displays achievements with resolved asset names
 */
export const AchievementDisplay: React.FC<AchievementDisplayProps> = ({
  result,
  loading = false,
}) => {
  const { data: mostActiveAssetMetadata, isLoading: resolving } = useAssetQuery(
    result?.mostActiveAsset ?? "",
  );

  if (loading || !result) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-48" />
        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Most Active Asset */}
      <div className="rounded-lg bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 p-3 sm:p-4 overflow-hidden">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="truncate">Most Active Asset</span>
        </h3>
        {resolving ? (
          <div className="flex items-center gap-2 animate-pulse">
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full" />
            <span className="text-gray-500">Resolving...</span>
          </div>
        ) : mostActiveAssetMetadata ? (
          <AssetDisplay
            code={mostActiveAssetMetadata.code}
            issuer={mostActiveAssetMetadata.issuer}
            showLogo={true}
            showCode={true}
            showFullName={true}
            size="md"
            className="text-lg font-bold"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {result.mostActiveAsset}
            </span>
          </div>
        )}
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-2 sm:p-3 overflow-hidden">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            TRANSACTIONS
          </p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
            {result.totalTransactions}
          </p>
        </div>
        <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-2 sm:p-3 overflow-hidden">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            VOLUME
          </p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
            {result.totalVolume.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Contract Calls */}
      {result.contractCalls > 0 && (
        <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-2 sm:p-3 overflow-hidden">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            CONTRACT CALLS
          </p>
          <p className="text-lg sm:text-xl font-bold text-purple-900 dark:text-purple-300 break-words">
            {result.contractCalls}
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Compact card showing most active asset
 */
export const MostActiveAssetCard: React.FC<{
  code: string;
  issuer?: string;
}> = ({ code, issuer }) => {
  return (
    <div className="rounded-xl bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 p-4 sm:p-6 overflow-hidden">
      <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">
        Your Most Active Asset
      </p>
      <div className="overflow-hidden">
        <AssetDisplay
          code={code}
          issuer={issuer}
          showLogo={true}
          showCode={true}
          showFullName={true}
          size="lg"
          className="text-lg sm:text-xl break-words"
        />
      </div>
    </div>
  );
};

/**
 * Mini badge for displaying asset in inline contexts
 */
export const AssetBadgeInline: React.FC<{ code: string; issuer?: string }> = ({
  code,
  issuer,
}) => {
  return (
    <AssetBadge
      code={code}
      issuer={issuer}
      showLogo={false}
      showCode={true}
      size="sm"
      className="inline-flex"
    />
  );
};

export default AchievementDisplay;
