"use client";

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, Filter, Check, RefreshCw } from "lucide-react";
import { useAssetListStore, type WalletAsset, type AssetSortOption, type AssetFilterOption } from "../store/assetListStore";
import { fetchWalletBalances, filterAssets, sortAssets, getAssetKey, formatStellarBalance } from "../services/walletBalanceService";
import { AssetDisplay } from "./AssetDisplay";
import { useWrapStore } from "../store/wrapStore";

interface AssetListProps {
  className?: string;
  showSelection?: boolean;
}

export function AssetList({ className = "", showSelection = true }: AssetListProps) {
  const {
    assets,
    isLoading,
    error,
    sortBy,
    filterBy,
    selectedAssets,
    setAssets,
    setLoading,
    setError,
    setSortBy,
    setFilterBy,
    toggleAssetSelection,
    clearSelection,
  } = useAssetListStore();

  const { address, network } = useWrapStore();

  // Fetch wallet balances when address changes
  useEffect(() => {
    if (!address) return;

    const loadBalances = async () => {
      setLoading(true);
      setError(null);

      try {
        const balances = await fetchWalletBalances({
          address,
          network: network === "testnet" ? "testnet" : "mainnet",
        });
        setAssets(balances);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load assets");
      } finally {
        setLoading(false);
      }
    };

    loadBalances();
  }, [address, network, setAssets, setLoading, setError]);

  // Apply filter and sort
  const processedAssets = useMemo(() => {
    const filtered = filterAssets(assets, filterBy);
    const sorted = sortAssets(filtered, sortBy);
    return sorted;
  }, [assets, filterBy, sortBy]);

  const handleSortChange = (newSort: AssetSortOption) => {
    setSortBy(newSort);
  };

  const handleFilterChange = (newFilter: AssetFilterOption) => {
    setFilterBy(newFilter);
  };

  const handleRefresh = () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    fetchWalletBalances({
      address,
      network: network === "testnet" ? "testnet" : "mainnet",
    })
      .then(setAssets)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to refresh assets"))
      .finally(() => setLoading(false));
  };

  const handleToggleSelection = (asset: WalletAsset) => {
    const key = getAssetKey(asset);
    toggleAssetSelection(key);
  };

  const handleClearSelection = () => {
    clearSelection();
  };

  if (!address) {
    return (
      <div className={`p-6 text-center ${className}`}>
        <p className="text-white/60">Connect your wallet to view assets</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Wallet Assets</h2>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-theme-primary"
            aria-label="Refresh assets"
          >
            <RefreshCw className={`w-4 h-4 text-white ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as AssetSortOption)}
              className="appearance-none bg-white/10 text-white px-3 py-2 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-theme-primary cursor-pointer"
              aria-label="Sort assets"
            >
              <option value="balance-desc">Balance: High to Low</option>
              <option value="balance-asc">Balance: Low to High</option>
              <option value="code-asc">Code: A to Z</option>
              <option value="code-desc">Code: Z to A</option>
            </select>
            <ArrowUpDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
          </div>

          {/* Filter dropdown */}
          <div className="relative">
            <select
              value={filterBy}
              onChange={(e) => handleFilterChange(e.target.value as AssetFilterOption)}
              className="appearance-none bg-white/10 text-white px-3 py-2 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-theme-primary cursor-pointer"
              aria-label="Filter assets"
            >
              <option value="all">All Assets</option>
              <option value="native">Native Only</option>
              <option value="custom">Custom Assets</option>
            </select>
            <Filter className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Selection controls */}
      {showSelection && selectedAssets.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center justify-between p-3 bg-theme-primary/20 border border-theme-primary/30 rounded-lg"
        >
          <span className="text-sm font-medium text-white">
            {selectedAssets.size} asset{selectedAssets.size !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={handleClearSelection}
            className="text-sm font-medium text-white/70 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-theme-primary rounded"
          >
            Clear selection
          </button>
        </motion.div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="p-4 bg-white/5 rounded-lg animate-pulse"
              aria-hidden="true"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-24" />
                  <div className="h-3 bg-white/10 rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && processedAssets.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-white/60">No assets found</p>
        </div>
      )}

      {/* Asset list */}
      <AnimatePresence mode="popLayout">
        {!isLoading && !error && processedAssets.length > 0 && (
          <div className="space-y-2">
            {processedAssets.map((asset) => {
              const assetKey = getAssetKey(asset);
              const isSelected = selectedAssets.has(assetKey);

              return (
                <motion.div
                  key={assetKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-theme-primary/20 border-theme-primary/50"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  }`}
                  onClick={() => showSelection && handleToggleSelection(asset)}
                  role={showSelection ? "button" : undefined}
                  aria-pressed={showSelection ? isSelected : undefined}
                  aria-label={`Asset ${asset.code}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {showSelection && (
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-theme-primary flex items-center justify-center">
                              <Check className="w-4 h-4 text-black" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-white/30" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <AssetDisplay
                          code={asset.code}
                          issuer={asset.issuer}
                          showLogo
                          showCode
                          showFullName={false}
                          size="sm"
                        />
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-bold text-white">
                        {formatStellarBalance(asset.balance)}
                      </p>
                      <p className="text-xs text-white/60">{asset.code}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AssetList;
