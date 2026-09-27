"use client";

import React, { useCallback, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Trash2,
  ArrowRightLeft,
} from "lucide-react";
import { useWrapStore } from "@/app/store/wrapStore";
import { useOfferStore, type Offer, type OfferStatus } from "@/app/store/offerStore";
import { createOffer, type OfferServiceError } from "@/src/services/offerService";
import { ProgressIndicator } from "@/app/components/ProgressIndicator";
import { useVirtualizer } from '@tanstack/react-virtual';

// ─── Constants ────────────────────────────────────────────────────────────────

const POPULAR_ASSETS = ["XLM", "USDC", "AQUA", "yXLM", "BTC", "ETH"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stable status display config — defined outside component to avoid recreation. */
const STATUS_CONFIG: Record<
  OfferStatus,
  { label: string; classes: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    classes: "bg-yellow-900/50 text-yellow-300 border-yellow-700/50",
    icon: <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />,
  },
  confirmed: {
    label: "Confirmed",
    classes: "bg-emerald-900/50 text-emerald-300 border-emerald-700/50",
    icon: <CheckCircle className="w-3 h-3" aria-hidden="true" />,
  },
  failed: {
    label: "Failed",
    classes: "bg-red-900/50 text-red-300 border-red-700/50",
    icon: <XCircle className="w-3 h-3" aria-hidden="true" />,
  },
};

function StatusBadge({ status }: { status: OfferStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.classes}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function OfferRow({
  offer,
  onDismiss,
}: {
  offer: Offer;
  onDismiss: (id: string) => void;
}) {
  return (
    <li
      key={offer.id}
      className="flex items-start justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold">
            {offer.amount}{" "}
            <span className="text-slate-300">{offer.sellingAsset}</span>
          </span>
          <ArrowRightLeft
            className="w-3.5 h-3.5 text-slate-500 shrink-0"
            aria-hidden="true"
          />
          <span className="text-sm font-bold text-slate-300">
            {offer.buyingAsset}
          </span>
          <span className="text-xs text-slate-500">@ {offer.price}</span>
        </div>

        {offer.onChainId && (
          <p className="text-xs text-slate-500 mt-1">
            On-chain ID:{" "}
            <span className="font-mono">{offer.onChainId}</span>
          </p>
        )}

        {offer.error && (
          <p className="text-xs text-red-400 mt-1">{offer.error}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={offer.status} />
        {offer.status === "failed" && (
          <button
            onClick={() => onDismiss(offer.id)}
            className="p-1 rounded-md text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
            aria-label={`Dismiss failed offer for ${offer.sellingAsset}/${offer.buyingAsset}`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

// ─── Form state type ──────────────────────────────────────────────────────────

interface FormValues {
  sellingAsset: string;
  buyingAsset: string;
  amount: string;
  price: string;
}

const INITIAL_FORM: FormValues = {
  sellingAsset: "XLM",
  buyingAsset: "USDC",
  amount: "",
  price: "",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OffersPage() {
  const { address: walletAddress, network } = useWrapStore();

  // Selective subscriptions to prevent unnecessary re-renders
  const offers = useOfferStore((s) => s.offers);
  const addOptimisticOffer = useOfferStore((s) => s.addOptimisticOffer);
  const confirmOffer = useOfferStore((s) => s.confirmOffer);
  const rollbackOffer = useOfferStore((s) => s.rollbackOffer);
  const dismissFailedOffer = useOfferStore((s) => s.dismissFailedOffer);

  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoised offer counts for the summary bar
  const { pendingCount, confirmedCount } = useMemo(
    () => ({
      pendingCount: offers.filter((o) => o.status === "pending").length,
      confirmedCount: offers.filter((o) => o.status === "confirmed").length,
    }),
    [offers],
  );

  const handleInputChange = useCallback(
    (field: keyof FormValues) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormError(null);
      },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!walletAddress) {
        setFormError("Connect your wallet on the /connect page first.");
        return;
      }
      if (form.sellingAsset === form.buyingAsset) {
        setFormError("Selling and buying assets must be different.");
        return;
      }
      const amount = parseFloat(form.amount);
      const price = parseFloat(form.price);
      if (isNaN(amount) || amount <= 0) {
        setFormError("Enter a valid positive amount.");
        return;
      }
      if (isNaN(price) || price <= 0) {
        setFormError("Enter a valid positive price.");
        return;
      }

      setFormError(null);
      setIsSubmitting(true);

      // ── 1. Generate a stable temporary ID ───────────────────────────────────
      const tempId = `optimistic-${Date.now()}`;

      // ── 2. Optimistic update — UI reflects the offer immediately ─────────────
      addOptimisticOffer({
        id: tempId,
        side: "sell",
        sellingAsset: form.sellingAsset,
        buyingAsset: form.buyingAsset,
        amount: form.amount,
        price: form.price,
      });

      // Reset form immediately (optimistic UX)
      setForm(INITIAL_FORM);

      // ── 3. Submit to service ─────────────────────────────────────────────────
      try {
        const result = await createOffer({
          accountAddress: walletAddress,
          sellingAsset: form.sellingAsset,
          buyingAsset: form.buyingAsset,
          amount: form.amount,
          price: form.price,
          network,
        });

        // ── 4. Confirm — replace optimistic with real data ───────────────────
        confirmOffer(tempId, result.onChainId);
      } catch (err: unknown) {
        // ── 5. Rollback — revert optimistic state and show error ─────────────
        const svcErr = err as OfferServiceError;
        rollbackOffer(
          tempId,
          svcErr.message ?? "Failed to create offer. Please try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      walletAddress,
      network,
      form,
      addOptimisticOffer,
      confirmOffer,
      rollbackOffer,
    ],
  );

  const handleDismiss = useCallback(
    (id: string) => {
      dismissFailedOffer(id);
    },
    [dismissFailedOffer],
  );

  // Virtualizer for the offers list — only renders visible items
  const containerRef = useRef<HTMLDivElement>(null);

  const offerVirtualizer = useVirtualizer({
    count: offers.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen bg-[var(--background)] text-[var(--foreground)]"
      id="main-content"
    >
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            Offer Creation
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
            Create DEX sell offers on the Stellar network. Your offer appears
            instantly in the list (optimistic update) while the transaction
            confirms on-chain.
          </p>
        </div>

        <div className="mb-8">
          <ProgressIndicator currentPage="offers" />
        </div>

        {/* Wallet status */}
        {!walletAddress && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl border border-yellow-700/50 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-300"
            role="alert"
          >
            <AlertCircle
              className="w-4 h-4 mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              No wallet connected.{" "}
              <a href="/connect" className="underline underline-offset-2">
                Connect your wallet
              </a>{" "}
              to create offers.
            </span>
          </div>
        )}

        {/* Create Offer Form */}
        <section
          className="mb-8 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-6"
          aria-label="Create offer form"
        >
          <h2 className="text-base font-bold mb-5">New Sell Offer</h2>

          <form onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Selling asset */}
              <div>
                <label
                  htmlFor="sellingAsset"
                  className="block text-xs font-semibold text-slate-400 mb-1.5"
                >
                  Selling
                </label>
                <select
                  id="sellingAsset"
                  value={form.sellingAsset}
                  onChange={handleInputChange("sellingAsset")}
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-theme-primary)] transition"
                  aria-label="Asset to sell"
                >
                  {POPULAR_ASSETS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buying asset */}
              <div>
                <label
                  htmlFor="buyingAsset"
                  className="block text-xs font-semibold text-slate-400 mb-1.5"
                >
                  Buying
                </label>
                <select
                  id="buyingAsset"
                  value={form.buyingAsset}
                  onChange={handleInputChange("buyingAsset")}
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-theme-primary)] transition"
                  aria-label="Asset to buy"
                >
                  {POPULAR_ASSETS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              {/* Amount */}
              <div>
                <label
                  htmlFor="amount"
                  className="block text-xs font-semibold text-slate-400 mb-1.5"
                >
                  Amount
                </label>
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.0000001"
                  value={form.amount}
                  onChange={handleInputChange("amount")}
                  placeholder="e.g. 100"
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-sm text-[var(--foreground)] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-theme-primary)] transition"
                  aria-label="Amount to sell"
                  required
                />
              </div>

              {/* Price */}
              <div>
                <label
                  htmlFor="price"
                  className="block text-xs font-semibold text-slate-400 mb-1.5"
                >
                  Price (per unit)
                </label>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="0.0000001"
                  value={form.price}
                  onChange={handleInputChange("price")}
                  placeholder="e.g. 0.12"
                  className="w-full rounded-xl border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-sm text-[var(--foreground)] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-theme-primary)] transition"
                  aria-label="Price per unit"
                  required
                />
              </div>
            </div>

            {/* Form error */}
            <AnimatePresence>
              {formError && (
                <motion.p
                  key="form-error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 flex items-center gap-2 text-sm text-red-300"
                  role="alert"
                >
                  <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {formError}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isSubmitting || !walletAddress}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--color-theme-primary)] px-5 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  Submitting…
                </>
              ) : (
                "Create Offer"
              )}
            </button>
          </form>
        </section>

        {/* Offer list */}
        <section aria-label="Your offers">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">Your Offers</h2>
            {(pendingCount > 0 || confirmedCount > 0) && (
              <div className="flex gap-2 text-xs">
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-700/50 font-semibold">
                    {pendingCount} pending
                  </span>
                )}
                {confirmedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700/50 font-semibold">
                    {confirmedCount} confirmed
                  </span>
                )}
              </div>
            )}
          </div>

          {offers.length === 0 ? (
            <div className="text-center py-14 text-slate-500 rounded-2xl border border-slate-800/60 bg-slate-900/30">
              <ArrowRightLeft
                className="w-9 h-9 mx-auto mb-3 opacity-30"
                aria-hidden="true"
              />
              <p className="font-semibold text-sm">No offers yet</p>
              <p className="text-xs mt-1">
                Your submitted offers will appear here instantly.
              </p>
            </div>
          ) : (
            <div
              ref={containerRef}
              style={{ maxHeight: '600px', overflow: 'auto' }}
            >
              <ul
                className="flex flex-col gap-2"
                role="list"
                aria-live="polite"
                style={{
                  height: `${offerVirtualizer.getTotalSize()}px`,
                  position: 'relative',
                }}
              >
                <AnimatePresence initial={false}>
                  {offerVirtualizer.getVirtualItems().map((virtualRow) => {
                    const offer = offers[virtualRow.index];
                    return (
                      <motion.li
                        key={offer.id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.25 }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <OfferRow
                          offer={offer}
                          onDismiss={handleDismiss}
                        />
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
