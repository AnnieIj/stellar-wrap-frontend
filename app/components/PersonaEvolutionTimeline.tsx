"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWrapStore } from "@/app/store/wrapStore";
import { getArchetypeStyle } from "@/src/data/archetypeConfig";
import {
  fetchUserWrapHistory,
  getDemoWrapHistory,
  type WrapRecord,
} from "@/src/services/wrapHistoryService";

interface PersonaEvolutionTimelineProps {
  /** Use demo data with multiple periods for preview */
  useDemo?: boolean;
}

export function PersonaEvolutionTimeline({ useDemo = false }: PersonaEvolutionTimelineProps) {
  const { address, network, result, period } = useWrapStore();
  const [wraps, setWraps] = useState<WrapRecord[]>([]);
  const [selected, setSelected] = useState<WrapRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const currentArchetype = result?.persona ?? "The Wizard";
  const currentTxCount = result?.totalTransactions ?? 0;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      if (useDemo) {
        const demo = getDemoWrapHistory(currentArchetype, currentTxCount);
        if (!cancelled) {
          setWraps(demo);
          setSelected(demo[demo.length - 1] ?? null);
          setLoading(false);
        }
        return;
      }

      if (!address) {
        const single: WrapRecord[] = [
          {
            period: period,
            periodLabel: "Current",
            archetype: currentArchetype,
            transactionCount: currentTxCount,
          },
        ];
        if (!cancelled) {
          setWraps(single);
          setSelected(single[0]);
          setLoading(false);
        }
        return;
      }

      try {
        const history = await fetchUserWrapHistory(
          address,
          network,
          currentArchetype,
          currentTxCount,
        );
        if (!cancelled) {
          setWraps(history);
          setSelected(history[history.length - 1] ?? null);
        }
      } catch {
        if (!cancelled) {
          const fallback: WrapRecord[] = [
            {
              period: "current",
              periodLabel: "Current",
              archetype: currentArchetype,
              transactionCount: currentTxCount,
            },
          ];
          setWraps(fallback);
          setSelected(fallback[0]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [address, network, currentArchetype, currentTxCount, period, useDemo]);

  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-6">
        <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (wraps.length <= 1) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl mx-auto px-4 py-6 text-center"
      >
        <h3 className="text-sm uppercase tracking-[0.2em] text-white/40 mb-2">
          Your Persona Journey
        </h3>
        <p className="text-white/50 italic text-sm">
          Keep wrapping to see your evolution!
        </p>
      </motion.div>
    );
  }

  const currentPeriod = wraps[wraps.length - 1]?.period;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-4xl mx-auto px-4 py-6"
    >
      <h3 className="text-sm uppercase tracking-[0.2em] text-white/40 mb-6 text-center">
        Your Persona Journey
      </h3>

      <div className="relative overflow-x-auto pb-2">
        <div className="flex items-center gap-0 min-w-max px-2">
          {wraps.map((wrap, i) => {
            const style = getArchetypeStyle(wrap.archetype);
            const Icon = style.icon;
            const isCurrent = wrap.period === currentPeriod;
            const isSelected = selected?.period === wrap.period;

            return (
              <motion.div
                key={wrap.period}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center"
              >
                <button
                  type="button"
                  onClick={() => setSelected(wrap)}
                  className={`flex flex-col items-center gap-2 px-3 py-2 rounded-xl transition-all min-w-[88px] ${
                    isSelected ? "bg-white/10 scale-105" : "hover:bg-white/5"
                  }`}
                >
                  <div
                    className={`relative w-14 h-14 rounded-full flex items-center justify-center border-2 ${
                      isCurrent ? "ring-2 ring-offset-2 ring-offset-black" : ""
                    }`}
                    style={{
                      borderColor: style.color,
                      background: style.gradient,
                      // `ring-2` above reads its color from this CSS custom
                      // property, not a `ringColor` inline style (not a
                      // real CSS property — Tailwind's ring utilities are
                      // box-shadow-based).
                      ...(isCurrent ? { "--tw-ring-color": style.color } as CSSProperties : {}),
                    }}
                  >
                    <Icon className="w-6 h-6 text-white" />
                    {isCurrent && (
                      <span className="absolute -top-2 -right-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-black text-white border border-white/20">
                        Now
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-white/40 font-medium">
                    {wrap.periodLabel}
                  </span>
                  <span
                    className="text-xs font-bold text-center leading-tight max-w-[80px] truncate"
                    style={{ color: style.color }}
                  >
                    {wrap.archetype.replace("The ", "")}
                  </span>
                </button>

                {i < wraps.length - 1 && (
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: i * 0.1 + 0.15, duration: 0.3 }}
                    className="w-8 h-0.5 shrink-0 origin-left"
                    style={{ background: style.gradient }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selected.period}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center"
          >
            <p className="text-lg font-black text-white">{selected.archetype}</p>
            <p className="text-sm text-white/50 mt-1">{selected.periodLabel}</p>
            <div className="flex justify-center gap-6 mt-3 text-sm">
              <div>
                <p className="text-white/40 text-xs uppercase">Transactions</p>
                <p className="font-bold text-white">
                  {selected.transactionCount.toLocaleString()}
                </p>
              </div>
              {selected.totalVolume != null && (
                <div>
                  <p className="text-white/40 text-xs uppercase">Volume</p>
                  <p className="font-bold text-white">
                    {selected.totalVolume.toLocaleString()} XLM
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
