"use client";

import React from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/app/components/Navbar";
import { TrustlineManager } from "@/app/components/TrustlineManager";
import { useWrapStore } from "@/app/store/wrapStore";
import { useTheme } from "@/app/context/ThemeContext";
import Link from "next/link";
import { Wallet } from "lucide-react";

export default function TrustlinesPage() {
  const { address } = useWrapStore();
  const { mode } = useTheme();

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 sm:px-8 bg-theme-background">
      <Navbar />

      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1
            className="text-3xl sm:text-4xl font-black mb-2 tracking-tight"
            style={{ color: mode === "dark" ? "#fff" : "#000" }}
          >
            Asset Trustlines
          </h1>
          <p className="text-sm sm:text-base text-white/60 max-w-xl mx-auto">
            Manage your asset trustlines on the Stellar network with instant optimistic updates and seamless Freighter wallet signing.
          </p>
        </motion.div>

        {!address ? (
          <div className="p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md text-center max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto text-white/70">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Wallet Not Connected</h2>
              <p className="text-xs text-white/50 mt-1">
                Please connect your Stellar wallet (Freighter, Albedo, etc.) to manage trustlines.
              </p>
            </div>
            <Link
              href="/connect"
              className="inline-flex items-center justify-center w-full py-3 rounded-xl bg-[var(--color-theme-primary)] text-black font-bold text-sm transition-opacity hover:opacity-90"
            >
              Connect Wallet
            </Link>
          </div>
        ) : (
          <TrustlineManager />
        )}
      </div>
    </div>
  );
}
