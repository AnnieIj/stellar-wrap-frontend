import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface WalletAsset {
  code: string;
  issuer?: string;
  balance: string;
  assetType: "native" | "credit_alphanum4" | "credit_alphanum12";
}

export type AssetSortOption = "balance-desc" | "balance-asc" | "code-asc" | "code-desc";
export type AssetFilterOption = "all" | "native" | "custom";

interface AssetListState {
  assets: WalletAsset[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  sortBy: AssetSortOption;
  filterBy: AssetFilterOption;
  selectedAssets: Set<string>;
  
  // Actions
  setAssets: (assets: WalletAsset[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSortBy: (sortBy: AssetSortOption) => void;
  setFilterBy: (filterBy: AssetFilterOption) => void;
  toggleAssetSelection: (assetKey: string) => void;
  clearSelection: () => void;
  reset: () => void;
}

const PERSISTENCE_KEY = "stellar-wrap-asset-list";

export const useAssetListStore = create<AssetListState>()(
  persist(
    (set, get) => ({
      assets: [],
      isLoading: false,
      error: null,
      lastFetched: null,
      sortBy: "balance-desc",
      filterBy: "all",
      selectedAssets: new Set<string>(),

      setAssets: (assets) =>
        set({
          assets,
          lastFetched: Date.now(),
          error: null,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error, isLoading: false }),

      setSortBy: (sortBy) => set({ sortBy }),

      setFilterBy: (filterBy) => set({ filterBy }),

      toggleAssetSelection: (assetKey) => {
        const selectedAssets = new Set(get().selectedAssets);
        if (selectedAssets.has(assetKey)) {
          selectedAssets.delete(assetKey);
        } else {
          selectedAssets.add(assetKey);
        }
        set({ selectedAssets });
      },

      clearSelection: () => set({ selectedAssets: new Set<string>() }),

      reset: () =>
        set({
          assets: [],
          isLoading: false,
          error: null,
          lastFetched: null,
          sortBy: "balance-desc",
          filterBy: "all",
          selectedAssets: new Set<string>(),
        }),
    }),
    {
      name: PERSISTENCE_KEY,
      partialize: (state) => ({
        sortBy: state.sortBy,
        filterBy: state.filterBy,
        selectedAssets: Array.from(state.selectedAssets),
      }),
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.selectedAssets)) {
          state.selectedAssets = new Set(state.selectedAssets);
        }
      },
    },
  ),
);
