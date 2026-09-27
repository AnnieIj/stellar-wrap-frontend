"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import type { WrapPeriod } from "@app/store/wrapStore";
import { PERIODS } from "@app/utils/indexer";

interface TransactionHeatmapProps {
  dailyActivity: Record<string, number>;
  period: WrapPeriod;
}

function formatTooltipDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getIntensityColor(count: number, max: number): string {
  if (count === 0) return "rgba(255,255,255,0.06)";
  const ratio = max > 0 ? count / max : 0;
  if (ratio < 0.25) return "rgba(var(--color-theme-primary-rgb), 0.25)";
  if (ratio < 0.5) return "rgba(var(--color-theme-primary-rgb), 0.45)";
  if (ratio < 0.75) return "rgba(var(--color-theme-primary-rgb), 0.7)";
  return "var(--color-theme-primary)";
}

export function TransactionHeatmap({ dailyActivity, period }: TransactionHeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    date: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const { cells, maxCount, mostActiveDay, dayLabels } = useMemo(() => {
    const days = PERIODS[period] ?? 30;
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);

    const result: { date: string; count: number }[] = [];
    let max = 0;
    let peak = "";

    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().split("T")[0];
      const count = dailyActivity[key] ?? 0;
      result.push({ date: key, count });
      if (count > max) {
        max = count;
        peak = key;
      }
    }

    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      labels.push(d.toLocaleDateString("en-US", { weekday: "narrow" }));
    }

    return {
      cells: result,
      maxCount: max,
      mostActiveDay: peak,
      dayLabels: labels,
    };
  }, [dailyActivity, period]);

  const isYearly = period === "yearly";
  const cols = isYearly ? Math.ceil(cells.length / 7) : 7;
  const isScrollable = isYearly;

  const gridStyle = isYearly
    ? { gridTemplateRows: `repeat(7, var(--cell-size))`, gridAutoFlow: "column" as const }
    : { gridTemplateColumns: `repeat(7, var(--cell-size))`, gridAutoFlow: "row" as const };

  const renderCells = () =>
    cells.map((cell) => {
      const isPeak = cell.date === mostActiveDay && cell.count > 0;
      return (
        <div
          key={cell.date}
          className="relative h-[var(--cell-size)] w-[var(--cell-size)] cursor-pointer rounded-sm transition-transform hover:scale-125"
          style={{ backgroundColor: getIntensityColor(cell.count, maxCount) }}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setTooltip({
              date: cell.date,
              count: cell.count,
              x: rect.left + rect.width / 2,
              y: rect.top,
            });
          }}
          onMouseLeave={() => setTooltip(null)}
          onClick={() =>
            setTooltip({
              date: cell.date,
              count: cell.count,
              x: 0,
              y: 0,
            })
          }
          title={`${cell.count} transaction${cell.count === 1 ? "" : "s"} on ${formatTooltipDate(cell.date)}`}
        >
          {isPeak && (
            <Star className="absolute -top-1 -right-1 h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
          )}
        </div>
      );
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="mt-8 w-full sm:mt-10"
    >
      <h3 className="mb-3 text-xs font-black tracking-[0.25em] text-white/50 sm:mb-4 sm:text-sm">
        ACTIVITY HEATMAP
      </h3>

      <div
        className={`rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur [--cell-size:0.75rem] sm:rounded-2xl sm:p-5 sm:[--cell-size:1rem] ${
          isScrollable ? "overflow-x-auto" : ""
        }`}
      >
        {!isYearly && (
          <div
            className="mx-auto mb-2 grid w-max gap-1 text-[10px] font-bold text-white/40"
            style={{ gridTemplateColumns: `repeat(7, var(--cell-size))` }}
          >
            {dayLabels.map((label, i) => (
              <span key={i} className="text-center">
                {label}
              </span>
            ))}
          </div>
        )}

        {isYearly ? (
          <div className="flex w-max">
            <div
              className="mr-1 grid gap-1 text-[10px] font-bold text-white/40"
              style={{ gridTemplateRows: `repeat(7, var(--cell-size))` }}
            >
              {dayLabels.map((label, i) => (
                <span key={i} className="flex items-center justify-center">
                  {label}
                </span>
              ))}
            </div>
            <div className="grid gap-1" style={gridStyle}>
              {renderCells()}
            </div>
          </div>
        ) : (
          <div className="mx-auto grid w-max gap-1" style={gridStyle}>
            {renderCells()}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex items-center gap-2 text-[10px] text-white/50">
          <span>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((level) => (
            <div
              key={level}
              className="h-3 w-3 rounded-sm"
              style={{
                backgroundColor: getIntensityColor(level * (maxCount || 1), maxCount || 1),
              }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {tooltip && (
        <div className="mt-2 text-center text-sm font-medium text-white/70">
          {tooltip.count} transaction{tooltip.count === 1 ? "" : "s"} on{" "}
          {formatTooltipDate(tooltip.date)}
        </div>
      )}
    </motion.div>
  );
}
