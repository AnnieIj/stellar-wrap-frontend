"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
import { useTheme, ThemeProvider } from "@/app/context/ThemeContext";

// Mock archetype icons
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

// Mock wrap data
const mockWraps = [
  {
    id: "1",
    period: "Yearly 2026",
    persona: "The Wizard",
    mintDate: "2026-01-15",
    transactionCount: 142,
    volume: "12500.50",
    topDapp: "Soroswap",
    vibeTags: ["Creative", "Strategic"],
  },
  {
    id: "2",
    period: "Monthly 2025-12",
    persona: "The Explorer",
    mintDate: "2026-01-01",
    transactionCount: 45,
    volume: "3200.00",
    topDapp: "StellarX",
    vibeTags: ["Curious", "Adventurous"],
  },
  {
    id: "3",
    period: "Monthly 2025-11",
    persona: "The Trader",
    mintDate: "2025-12-01",
    transactionCount: 87,
    volume: "8900.25",
    topDapp: "Soroswap",
    vibeTags: ["Active", "Focused"],
  },
];

// This route lives outside app/[locale], so app/[locale]/layout.tsx's
// ThemeProvider never wraps it (the only other layout, root app/layout.tsx,
// deliberately renders no providers to avoid nested <html> tags with the
// locale layout). Providing ThemeProvider locally here is the safe, scoped
// fix — restructuring the shared layouts risks breaking the working
// [locale] tree.
export default function ComparePage() {
  return (
    <ThemeProvider>
      <ComparePageContent />
    </ThemeProvider>
  );
}

function ComparePageContent() {
  const { mode } = useTheme();
  const [period1Id, setPeriod1Id] = useState(mockWraps[0].id);
  const [period2Id, setPeriod2Id] = useState(mockWraps[1].id);

  const wrap1 = mockWraps.find((w) => w.id === period1Id);
  const wrap2 = mockWraps.find((w) => w.id === period2Id);

  const calculateDelta = (current: number, previous: number) => {
    if (previous === 0) return { value: 100, isPositive: true };
    const delta = ((current - previous) / previous) * 100;
    return { value: Math.round(delta), isPositive: delta >= 0 };
  };

  const txDelta = wrap1 && wrap2 ? calculateDelta(wrap1.transactionCount, wrap2.transactionCount) : null;
  const volumeDelta = wrap1 && wrap2 ? calculateDelta(parseFloat(wrap1.volume), parseFloat(wrap2.volume)) : null;

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-8" style={{ touchAction: "pan-y" }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/history"
              className="text-sm font-semibold transition-colors"
              style={{ color: mode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--color-theme-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = mode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)";
              }}
            >
              ← Back to History
            </Link>
          </div>
          <h1
            className="text-4xl sm:text-5xl font-black mb-2"
            style={{ color: mode === "dark" ? "#fff" : "#000" }}
          >
            Compare Your Wraps
          </h1>
          <p style={{ color: mode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" }}>
            See how your on-chain activity changed over time
          </p>
        </motion.div>

        {/* Period selectors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <div>
            <label
              className="block text-sm font-bold mb-2"
              style={{ color: mode === "dark" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)" }}
            >
              First Period
            </label>
            <select
              value={period1Id}
              onChange={(e) => setPeriod1Id(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border font-medium"
              style={{
                backgroundColor: mode === "dark" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
                borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                color: mode === "dark" ? "#fff" : "#000",
              }}
            >
              {mockWraps.map((wrap) => (
                <option key={wrap.id} value={wrap.id}>
                  {wrap.period}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="block text-sm font-bold mb-2"
              style={{ color: mode === "dark" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)" }}
            >
              Second Period
            </label>
            <select
              value={period2Id}
              onChange={(e) => setPeriod2Id(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border font-medium"
              style={{
                backgroundColor: mode === "dark" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
                borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                color: mode === "dark" ? "#fff" : "#000",
              }}
            >
              {mockWraps.map((wrap) => (
                <option key={wrap.id} value={wrap.id}>
                  {wrap.period}
                </option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Summary */}
        {wrap1 && wrap2 && txDelta && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8 p-6 rounded-2xl border"
            style={{
              backgroundColor: "rgba(var(--color-theme-primary-rgb), 0.1)",
              borderColor: "rgba(var(--color-theme-primary-rgb), 0.3)",
            }}
          >
            <p
              className="text-xl sm:text-2xl font-bold text-center"
              style={{ color: "var(--color-theme-primary)" }}
            >
              Your activity {txDelta.isPositive ? "increased" : "decreased"} by {Math.abs(txDelta.value)}% between{" "}
              {wrap2.period} and {wrap1.period}
            </p>
          </motion.div>
        )}

        {/* Comparison layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Period 1 */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            {wrap1 ? (
              <WrapCard wrap={wrap1} mode={mode} />
            ) : (
              <EmptyCard mode={mode} />
            )}
          </motion.div>

          {/* Period 2 */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            {wrap2 ? (
              <WrapCard wrap={wrap2} mode={mode} />
            ) : (
              <EmptyCard mode={mode} />
            )}
          </motion.div>
        </div>

        {/* Metrics comparison table */}
        {wrap1 && wrap2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12 border rounded-2xl overflow-hidden"
            style={{
              backgroundColor: mode === "dark" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
              borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 border-b" style={{ borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
              <div className="p-6">
                <p
                  className="text-sm font-bold"
                  style={{ color: mode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
                >
                  Metric
                </p>
              </div>
              <div className="p-6 border-l" style={{ borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                <p
                  className="text-sm font-bold"
                  style={{ color: mode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
                >
                  {wrap1.period}
                </p>
              </div>
              <div className="p-6 border-l" style={{ borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                <p
                  className="text-sm font-bold"
                  style={{ color: mode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
                >
                  {wrap2.period}
                </p>
              </div>
            </div>

            {/* Transaction count row */}
            <ComparisonRow
              label="Transactions"
              value1={wrap1.transactionCount}
              value2={wrap2.transactionCount}
              mode={mode}
            />

            {/* Volume row */}
            <ComparisonRow
              label="Volume (XLM)"
              value1={`${wrap1.volume} XLM`}
              value2={`${wrap2.volume} XLM`}
              numericValue1={parseFloat(wrap1.volume)}
              numericValue2={parseFloat(wrap2.volume)}
              mode={mode}
            />

            {/* Top dApp row */}
            <ComparisonRow
              label="Top DApp"
              value1={wrap1.topDapp}
              value2={wrap2.topDapp}
              mode={mode}
              isTextOnly
            />

            {/* Archetype row */}
            <ComparisonRow
              label="Archetype"
              value1={
                <div className="flex items-center gap-2">
                  <ArchetypeIcon name={wrap1.persona} />
                  <span className="text-lg font-bold">{wrap1.persona}</span>
                </div>
              }
              value2={
                <div className="flex items-center gap-2">
                  <ArchetypeIcon name={wrap2.persona} />
                  <span className="text-lg font-bold">{wrap2.persona}</span>
                </div>
              }
              mode={mode}
              isComponent
            />

            {/* Vibe tags row */}
            <ComparisonRow
              label="Vibe Tags"
              value1={wrap1.vibeTags}
              value2={wrap2.vibeTags}
              mode={mode}
              isTags
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function WrapCard({ wrap, mode }: { wrap: any; mode: "dark" | "light" }) {
  return (
    <div
      className="border rounded-2xl p-6"
      style={{
        backgroundColor: mode === "dark" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)",
        borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
      }}
    >
      <h3
        className="text-xl font-bold mb-4"
        style={{ color: mode === "dark" ? "#fff" : "#000" }}
      >
        {wrap.period}
      </h3>
      <div className="flex items-center gap-3 mb-6">
        <ArchetypeIcon name={wrap.persona} />
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: mode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
          >
            Archetype
          </p>
          <p
            className="text-lg font-bold"
            style={{ color: "var(--color-theme-primary)" }}
          >
            {wrap.persona}
          </p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <p
            className="text-sm font-semibold mb-1"
            style={{ color: mode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
          >
            Transactions
          </p>
          <p
            className="text-3xl font-black"
            style={{ color: mode === "dark" ? "#fff" : "#000" }}
          >
            {wrap.transactionCount}
          </p>
        </div>
        <div>
          <p
            className="text-sm font-semibold mb-1"
            style={{ color: mode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
          >
            Volume
          </p>
          <p
            className="text-3xl font-black"
            style={{ color: mode === "dark" ? "#fff" : "#000" }}
          >
            {wrap.volume} XLM
          </p>
        </div>
        <div>
          <p
            className="text-sm font-semibold mb-1"
            style={{ color: mode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)" }}
          >
            Top DApp
          </p>
          <p
            className="text-xl font-bold"
            style={{ color: mode === "dark" ? "#fff" : "#000" }}
          >
            {wrap.topDapp}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyCard({ mode }: { mode: "dark" | "light" }) {
  return (
    <div
      className="border rounded-2xl p-6 flex items-center justify-center"
      style={{
        backgroundColor: mode === "dark" ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.5)",
        borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
        minHeight: "300px",
      }}
    >
      <p
        className="text-center"
        style={{ color: mode === "dark" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)" }}
      >
        No data for this period
      </p>
    </div>
  );
}

function ComparisonRow({
  label,
  value1,
  value2,
  numericValue1,
  numericValue2,
  mode,
  isTextOnly = false,
  isComponent = false,
  isTags = false,
}: any) {
  let delta: { value: number; isPositive: boolean } | null = null;
  let isValue1Winner = false;

  if (numericValue1 !== undefined && numericValue2 !== undefined) {
    if (numericValue2 === 0) {
      delta = { value: 100, isPositive: true };
    } else {
      const d = ((numericValue1 - numericValue2) / numericValue2) * 100;
      delta = { value: Math.round(d), isPositive: d >= 0 };
    }
    isValue1Winner = numericValue1 > numericValue2;
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-3 border-b"
      style={{ borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}
    >
      <div className="p-6">
        <p
          className="text-lg font-bold"
          style={{ color: mode === "dark" ? "#fff" : "#000" }}
        >
          {label}
        </p>
      </div>

      <div
        className="p-6 border-l"
        style={{
          borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          backgroundColor: isValue1Winner && !isTextOnly && !isComponent && !isTags ? "rgba(var(--color-theme-primary-rgb), 0.1)" : "transparent",
        }}
      >
        <div className="flex items-center justify-between">
          {isComponent ? (
            <div style={{ color: mode === "dark" ? "#fff" : "#000" }}>{value1}</div>
          ) : isTags ? (
            <div className="flex flex-wrap gap-2">
              {(value1 as string[]).map((tag) => (
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
          ) : (
            <p
              className="text-xl font-bold"
              style={{ color: mode === "dark" ? "#fff" : "#000" }}
            >
              {value1}
            </p>
          )}
        </div>
      </div>

      <div
        className="p-6 border-l"
        style={{
          borderColor: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          backgroundColor: !isValue1Winner && !isTextOnly && !isComponent && !isTags && numericValue1 !== undefined ? "rgba(var(--color-theme-primary-rgb), 0.1)" : "transparent",
        }}
      >
        <div className="flex items-center justify-between">
          {isComponent ? (
            <div style={{ color: mode === "dark" ? "#fff" : "#000" }}>{value2}</div>
          ) : isTags ? (
            <div className="flex flex-wrap gap-2">
              {(value2 as string[]).map((tag) => (
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
          ) : (
            <p
              className="text-xl font-bold"
              style={{ color: mode === "dark" ? "#fff" : "#000" }}
            >
              {value2}
            </p>
          )}

          {delta && !isTextOnly && !isComponent && !isTags && (
            <div
              className="flex items-center gap-1 px-3 py-1 rounded-full"
              style={{
                backgroundColor: delta.isPositive ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
                color: delta.isPositive ? "#22c55e" : "#ef4444",
              }}
            >
              {delta.isPositive ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              <span className="text-sm font-bold">{Math.abs(delta.value)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
