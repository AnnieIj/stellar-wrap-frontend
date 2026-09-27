/**
 * Offer Store
 *
 * Manages DEX offer state with optimistic updates.
 *
 * Flow:
 *   1. addOptimisticOffer — immediately adds to list with status "pending"
 *   2. confirmOffer       — replaces optimistic entry with confirmed data
 *   3. rollbackOffer      — removes optimistic entry (tx failed)
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OfferStatus = "pending" | "confirmed" | "failed";

export type OfferSide = "buy" | "sell";

export interface Offer {
  /** Unique identifier. Optimistic entries use `optimistic-<timestamp>`. */
  id: string;
  side: OfferSide;
  /** Asset code being sold/offered (e.g. "XLM") */
  sellingAsset: string;
  /** Asset code being bought (e.g. "USDC") */
  buyingAsset: string;
  /** Amount in whole XLM (display value, stored as string to avoid float issues) */
  amount: string;
  /** Price per unit of selling asset */
  price: string;
  status: OfferStatus;
  /** On-chain offer ID after confirmation (null while pending or failed) */
  onChainId: string | null;
  /** Error message if status === "failed" */
  error: string | null;
  /** Unix timestamp (ms) when the offer was created */
  createdAt: number;
}

interface OfferStoreState {
  offers: Offer[];
  isSubmitting: boolean;
  submitError: string | null;

  // Actions
  addOptimisticOffer: (offer: Omit<Offer, "status" | "onChainId" | "error" | "createdAt">) => void;
  confirmOffer: (tempId: string, onChainId: string) => void;
  rollbackOffer: (tempId: string, error: string) => void;
  dismissFailedOffer: (id: string) => void;
  setSubmitting: (submitting: boolean) => void;
  setSubmitError: (error: string | null) => void;
  clearAll: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useOfferStore = create<OfferStoreState>()(
  persist(
    (set) => ({
      offers: [],
      isSubmitting: false,
      submitError: null,

      addOptimisticOffer: (offerData) => {
        const newOffer: Offer = {
          ...offerData,
          status: "pending",
          onChainId: null,
          error: null,
          createdAt: Date.now(),
        };
        // Prepend so newest is at top — no unnecessary re-renders on append
        set((state) => ({ offers: [newOffer, ...state.offers] }));
      },

      confirmOffer: (tempId, onChainId) => {
        set((state) => ({
          offers: state.offers.map((o) =>
            o.id === tempId
              ? { ...o, status: "confirmed", onChainId, error: null }
              : o,
          ),
        }));
      },

      rollbackOffer: (tempId, error) => {
        set((state) => ({
          offers: state.offers.map((o) =>
            o.id === tempId ? { ...o, status: "failed", error } : o,
          ),
        }));
      },

      dismissFailedOffer: (id) => {
        set((state) => ({
          offers: state.offers.filter((o) => o.id !== id),
        }));
      },

      setSubmitting: (submitting) => set({ isSubmitting: submitting }),
      setSubmitError: (error) => set({ submitError: error }),

      clearAll: () =>
        set({ offers: [], isSubmitting: false, submitError: null }),
    }),
    {
      name: "stellar-wrap-offers-storage",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      // Only persist confirmed offers to avoid stale pending state across sessions
      partialize: (state) => ({
        offers: state.offers.filter((o) => o.status === "confirmed"),
      }),
    },
  ),
);
