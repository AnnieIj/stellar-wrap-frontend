/**
 * Zustand store for managing Asset Trustlines with optimistic UI updates and automated rollback.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TrustlineItem } from "../types/trustline";
import { toStroops, isValidStellarAmount } from "../utils/stellarAmount";

interface TrustlineStoreState {
  trustlines: TrustlineItem[];
  isLoading: boolean;
  activeError: string | null;

  // Actions
  optimisticAddTrustline: (
    assetCode: string,
    assetIssuer: string,
    limit?: string
  ) => TrustlineItem;
  confirmTrustline: (
    assetCode: string,
    assetIssuer: string,
    transactionHash: string
  ) => void;
  revertTrustline: (
    assetCode: string,
    assetIssuer: string,
    errorMessage?: string
  ) => void;
  removeTrustline: (assetCode: string, assetIssuer: string) => void;
  setTrustlines: (trustlines: TrustlineItem[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setActiveError: (error: string | null) => void;
  clearAll: () => void;
}

function matchTrustline(
  item: TrustlineItem,
  code: string,
  issuer: string
): boolean {
  return (
    item.assetCode.toUpperCase() === code.toUpperCase() &&
    item.assetIssuer.trim() === issuer.trim()
  );
}

export const useTrustlineStore = create<TrustlineStoreState>()(
  persist(
    (set, get) => ({
      trustlines: [],
      isLoading: false,
      activeError: null,

      optimisticAddTrustline: (assetCode, assetIssuer, limit) => {
        const normalizedCode = assetCode.trim().toUpperCase();
        const normalizedIssuer = assetIssuer.trim();
        let limitStroops: bigint | undefined;

        if (limit && isValidStellarAmount(limit)) {
          try {
            limitStroops = toStroops(limit);
          } catch {
            // Ignore if calculation fails
          }
        }

        const newItem: TrustlineItem = {
          assetCode: normalizedCode,
          assetIssuer: normalizedIssuer,
          limit: limit ? limit.trim() : undefined,
          limitStroops,
          status: "pending",
          optimistic: true,
          createdAt: Date.now(),
        };

        set((state) => {
          // Remove previous item if it existed or replace
          const filtered = state.trustlines.filter(
            (t) => !matchTrustline(t, normalizedCode, normalizedIssuer)
          );
          return {
            trustlines: [newItem, ...filtered],
            activeError: null,
          };
        });

        return newItem;
      },

      confirmTrustline: (assetCode, assetIssuer, transactionHash) => {
        const normalizedCode = assetCode.trim().toUpperCase();
        const normalizedIssuer = assetIssuer.trim();

        set((state) => ({
          trustlines: state.trustlines.map((item) => {
            if (matchTrustline(item, normalizedCode, normalizedIssuer)) {
              return {
                ...item,
                status: "active",
                optimistic: false,
                transactionHash,
                error: undefined,
              };
            }
            return item;
          }),
        }));
      },

      revertTrustline: (assetCode, assetIssuer, errorMessage) => {
        const normalizedCode = assetCode.trim().toUpperCase();
        const normalizedIssuer = assetIssuer.trim();

        set((state) => {
          const target = state.trustlines.find((item) =>
            matchTrustline(item, normalizedCode, normalizedIssuer)
          );

          // If the trustline was created optimistically in this cycle, we mark it failed/reverting or remove it
          return {
            trustlines: state.trustlines.filter(
              (item) => !matchTrustline(item, normalizedCode, normalizedIssuer)
            ),
            activeError:
              errorMessage ||
              `Failed to create trustline for ${normalizedCode}. Optimistic update reverted.`,
          };
        });
      },

      removeTrustline: (assetCode, assetIssuer) => {
        const normalizedCode = assetCode.trim().toUpperCase();
        const normalizedIssuer = assetIssuer.trim();

        set((state) => ({
          trustlines: state.trustlines.filter(
            (item) => !matchTrustline(item, normalizedCode, normalizedIssuer)
          ),
        }));
      },

      setTrustlines: (trustlines) => {
        set({ trustlines });
      },

      setIsLoading: (isLoading) => {
        set({ isLoading });
      },

      setActiveError: (activeError) => {
        set({ activeError });
      },

      clearAll: () => {
        set({ trustlines: [], isLoading: false, activeError: null });
      },
    }),
    {
      name: "stellar-wrap-trustlines",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
      ),
      partialize: (state) => ({
        // Only persist confirmed active trustlines, avoid persisting stale pending/optimistic ones across reload
        trustlines: state.trustlines
          .filter((t) => t.status === "active" && !t.optimistic)
          .map((t) => ({
            ...t,
            limitStroops: undefined, // BigInt is not JSON-serializable
          })),
      }),
    }
  )
);
