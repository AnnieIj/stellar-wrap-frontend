"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Plus, AlertCircle, Loader2, CheckCircle2, XCircle, ExternalLink, Sparkles } from "lucide-react";
import { useTrustline } from "@/src/hooks/useTrustline";
import { useWrapStore } from "@/app/store/wrapStore";
import { KNOWN_ASSETS } from "@/app/utils/assetConstants";
import { isValidStellarAmount, formatStellarAmount } from "@/src/utils/stellarAmount";
import { AssetDisplay } from "./AssetDisplay";

interface PopularPreset {
  code: string;
  name: string;
  issuer: string;
}

const POPULAR_PRESETS: PopularPreset[] = [
  {
    code: "USDC",
    name: "USD Coin",
    issuer: KNOWN_ASSETS.USDC?.issuer || "GBBD47UZQ5O5K7PGQWUBZPC34EYWXVJ7UNVIOVG53FDKQ57ESVENSKWM",
  },
  {
    code: "USDT",
    name: "Tether USD",
    issuer: KNOWN_ASSETS.USDT?.issuer || "GBUQWP3BOUZX34ULNQG23RQ6F4BVWCIIY2IANU6S2HXE3MGWSup42YA",
  },
  {
    code: "BTC",
    name: "Bitcoin",
    issuer: KNOWN_ASSETS.BTC?.issuer || "GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEKMTCH",
  },
  {
    code: "ETH",
    name: "Ethereum",
    issuer: KNOWN_ASSETS.ETH?.issuer || "GBDESL6MT7SXE4NqkoJUKw6k3t3z5NB6LGYXPARHY3FZRWUF6XBZOJIE",
  },
];

export function TrustlineManager() {
  const { trustlines, addTrustline, isProcessing } = useTrustline();
  const { address, network } = useWrapStore();

  const [assetCode, setAssetCode] = useState("");
  const [assetIssuer, setAssetIssuer] = useState("");
  const [limit, setLimit] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCode = assetCode.trim().toUpperCase();
    const cleanIssuer = assetIssuer.trim();

    if (!cleanCode || cleanCode.length > 12) {
      setFormError("Asset code must be between 1 and 12 characters.");
      return;
    }

    if (!cleanIssuer.startsWith("G") || cleanIssuer.length !== 56) {
      setFormError("Asset issuer must be a valid 56-character Stellar public address starting with G.");
      return;
    }

    if (limit.trim() !== "" && !isValidStellarAmount(limit.trim())) {
      setFormError("Limit must be a valid positive amount with up to 7 decimal places.");
      return;
    }

    const success = await addTrustline({
      assetCode: cleanCode,
      assetIssuer: cleanIssuer,
      limit: limit.trim() !== "" ? limit.trim() : undefined,
    });

    if (success) {
      setAssetCode("");
      setAssetIssuer("");
      setLimit("");
    }
  };

  const handleSelectPreset = (preset: PopularPreset) => {
    setAssetCode(preset.code);
    setAssetIssuer(preset.issuer);
    setFormError(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header card */}
      <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-[var(--color-theme-primary)] text-black">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Asset Trustline Manager
            </h2>
            <p className="text-xs text-white/50">
              Establish trustlines on Stellar with instant optimistic updates and automatic rollback.
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-theme-primary)]" />
            Quick Presets
          </div>
          <div className="flex flex-wrap gap-2">
            {POPULAR_PRESETS.map((preset) => {
              const isAlreadyAdded = trustlines.some(
                (t) => t.assetCode.toUpperCase() === preset.code
              );

              return (
                <button
                  key={preset.code}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  disabled={isProcessing}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                    isAlreadyAdded
                      ? "border-green-500/40 bg-green-500/10 text-green-300"
                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  <span>{preset.code}</span>
                  {isAlreadyAdded && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="trustline-code" className="block text-xs font-medium text-white/60 mb-1">
                Asset Code (1-12 Chars)
              </label>
              <input
                id="trustline-code"
                type="text"
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
                placeholder="e.g. USDC"
                disabled={isProcessing}
                maxLength={12}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-theme-primary)] font-mono"
              />
            </div>
            <div>
              <label htmlFor="trustline-limit" className="block text-xs font-medium text-white/60 mb-1">
                Trust Limit (Optional, max 7 decimals)
              </label>
              <input
                id="trustline-limit"
                type="text"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="Default: Maximum"
                disabled={isProcessing}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-theme-primary)] font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="trustline-issuer" className="block text-xs font-medium text-white/60 mb-1">
              Asset Issuer (56-character Stellar Address)
            </label>
            <input
              id="trustline-issuer"
              type="text"
              value={assetIssuer}
              onChange={(e) => setAssetIssuer(e.target.value)}
              placeholder="G..."
              disabled={isProcessing}
              className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-theme-primary)] font-mono"
            />
          </div>

          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing || !assetCode.trim() || !assetIssuer.trim() || !address}
            className="w-full py-3 rounded-xl bg-[var(--color-theme-primary)] text-black font-bold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 shadow-lg shadow-[rgba(var(--color-theme-primary-rgb),0.2)]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Trustline...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add Trustline (Optimistic)</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Trustline List */}
      <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
        <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center justify-between">
          <span>Active & Pending Trustlines</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
            {trustlines.length}
          </span>
        </h3>

        {trustlines.length === 0 ? (
          <div className="py-8 text-center text-white/40 text-sm">
            No trustlines created yet. Add one above or select a quick preset.
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {trustlines.map((item) => (
                <motion.div
                  key={`${item.assetCode}:${item.assetIssuer}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    item.status === "pending"
                      ? "border-yellow-500/30 bg-yellow-500/5"
                      : "border-white/10 bg-black/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AssetDisplay code={item.assetCode} issuer={item.assetIssuer} size="md" />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-white/50">
                          {item.assetIssuer.slice(0, 6)}...{item.assetIssuer.slice(-4)}
                        </span>
                        {item.status === "pending" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 animate-pulse">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            OPTIMISTIC PENDING
                          </span>
                        )}
                        {item.status === "active" && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-400/20 text-green-300 border border-green-400/30">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            CONFIRMED
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-white/40 mt-1">
                        Limit: {item.limit ? formatStellarAmount(item.limit) : "Maximum"}
                      </div>
                    </div>
                  </div>

                  {item.transactionHash && (
                    <a
                      href={`https://stellar.expert/explorer/${
                        network === "testnet" ? "testnet" : "public"
                      }/tx/${item.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-white/60 hover:text-white flex items-center gap-1 shrink-0"
                    >
                      <span>View Tx</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

export default TrustlineManager;
