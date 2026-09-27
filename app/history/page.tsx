"use client";

import { motion } from "framer-motion";
import { useTheme, ThemeProvider } from "@/app/context/ThemeContext";
import { useWrapStore } from "@/app/store/wrapStore";
import Link from "next/link";

// Mock archetype icons (we'll use placeholder SVGs)
const ArchetypeIcon = ({ name }: { name: string }) => {
  const icons: Record<string, string> = {
    "The Wizard": "🧙",
    "The Explorer": "🧭",
    "The Collector": "🏆",
    "The Architect": "🏗️",
    "The Guardian": "🛡️",
    "The Creator": "✨",
    "The Trader": "💹",
    "The Community Builder": "🤝",
  };
  return <span className="text-4xl">{icons[name] || "🎭"}</span>;
};

// This route lives outside app/[locale], so app/[locale]/layout.tsx's
// ThemeProvider never wraps it (the only other layout, root app/layout.tsx,
// deliberately renders no providers to avoid nested <html> tags with the
// locale layout). Providing ThemeProvider locally here is the safe, scoped
// fix — restructuring the shared layouts risks breaking the working
// [locale] tree.
export default function HistoryPage() {
  return (
    <ThemeProvider>
      <HistoryPageContent />
    </ThemeProvider>
  );
}

function HistoryPageContent() {
  const { mode } = useTheme();
  const { address } = useWrapStore();

  // Mock wrap data for demonstration (we'll flesh this out later)
  const mockWraps = [
    {
      id: "1",
      period: "Yearly 2026",
      persona: "The Wizard",
      mintDate: "2026-01-15",
      transactionCount: 142,
      topDapp: "Soroswap",
      vibeTags: ["Creative", "Strategic"],
    },
    {
      id: "2",
      period: "Monthly 2025-12",
      persona: "The Explorer",
      mintDate: "2026-01-01",
      transactionCount: 45,
      topDapp: "StellarX",
      vibeTags: ["Curious", "Adventurous"],
    },
  ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-8" style={{ touchAction: "pan-y" }}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1
            className="text-4xl sm:text-5xl font-black mb-2"
            style={{ color: mode === "dark" ? "#fff" : "#000" }}
          >
            Your Wrap History
          </h1>
          <p style={{ color: mode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" }}>
            All your past wrap summaries in one place
          </p>
        </motion.div>

        {!address ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p style={{ color: mode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" }}>
              Connect your wallet to view your wrap history
            </p>
            <Link
              href="/connect"
              className="inline-block mt-4 px-8 py-3 rounded-full font-bold transition-all hover:scale-105"
              style={{ backgroundColor: "var(--color-theme-primary)", color: "#000" }}
            >
              Connect Wallet
            </Link>
          </motion.div>
        ) : mockWraps.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p style={{ color: mode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" }}>
              Mint your first wrap!
            </p>
            <Link
              href="/connect"
              className="inline-block mt-4 px-8 py-3 rounded-full font-bold transition-all hover:scale-105"
              style={{ backgroundColor: "var(--color-theme-primary)", color: "#000" }}
            >
              Start Your Wrap
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {mockWraps.map((wrap, index) => (
              <motion.div
                key={wrap.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border rounded-2xl p-6 overflow-hidden"
                style={{
                  backgroundColor: mode === "dark" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
                  borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <ArchetypeIcon name={wrap.persona} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3
                        className="text-xl font-bold"
                        style={{ color: mode === "dark" ? "#fff" : "#000" }}
                      >
                        {wrap.period}
                      </h3>
                      <span
                        className="text-sm"
                        style={{ color: mode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
                      >
                        {wrap.mintDate}
                      </span>
                    </div>
                    <p
                      className="text-lg font-semibold mb-2"
                      style={{ color: "var(--color-theme-primary)" }}
                    >
                      {wrap.persona}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div>
                        <p
                          className="text-sm"
                          style={{ color: mode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
                        >
                          Total Transactions
                        </p>
                        <p
                          className="text-2xl font-bold"
                          style={{ color: mode === "dark" ? "#fff" : "#000" }}
                        >
                          {wrap.transactionCount}
                        </p>
                      </div>
                      <div>
                        <p
                          className="text-sm"
                          style={{ color: mode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
                        >
                          Top DApp
                        </p>
                        <p
                          className="text-2xl font-bold"
                          style={{ color: mode === "dark" ? "#fff" : "#000" }}
                        >
                          {wrap.topDapp}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {wrap.vibeTags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 rounded-full text-sm font-semibold"
                          style={{
                            backgroundColor: "rgba(var(--color-theme-primary-rgb), 0.15)",
                            color: "var(--color-theme-primary)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* "Compare periods" button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: mockWraps.length * 0.1 }}
              className="mt-8"
            >
              <Link
                href="/history/compare"
                className="inline-flex items-center gap-2 w-full sm:w-auto px-8 py-3 rounded-full font-bold border transition-all hover:scale-105"
                style={{
                  borderColor: "var(--color-theme-primary)",
                  color: "var(--color-theme-primary)",
                  backgroundColor: "transparent",
                }}
              >
                Compare Periods
              </Link>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
