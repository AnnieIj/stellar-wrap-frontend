"use client";

import { ReactNode } from "react";

export type StatCardVariant = "primary" | "secondary";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  variant?: StatCardVariant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  id?: string;
}

export function StatCard({
  label,
  value,
  icon,
  description,
  variant = "primary",
  disabled = false,
  loading = false,
  className = "",
  id,
}: StatCardProps) {
  const cardId = id || `stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const labelId = `${cardId}-label`;
  const valueId = `${cardId}-value`;
  const descId = description ? `${cardId}-desc` : undefined;

  const baseClasses =
    "rounded-2xl border p-5 transition-all duration-200 focus-within:ring-2 focus-within:ring-theme-primary focus-within:ring-offset-2 focus-within:ring-offset-black";

  const variantClasses: Record<StatCardVariant, string> = {
    primary: "border-white/10 bg-white/5",
    secondary: "border-white/5 bg-white/[0.02]",
  };

  const disabledClasses = disabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-default";

  const combinedClasses = [
    baseClasses,
    variantClasses[variant],
    disabledClasses,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const displayValue = loading ? "—" : value;

  return (
    <div
      id={cardId}
      className={combinedClasses}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={descId}
      aria-disabled={disabled || loading}
      tabIndex={disabled ? -1 : 0}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon && (
          <span className="text-theme-primary" aria-hidden="true">
            {icon}
          </span>
        )}
        <span
          id={labelId}
          className="text-sm font-semibold text-white/60 uppercase tracking-wider"
        >
          {label}
        </span>
      </div>

      <p
        id={valueId}
        className="text-2xl font-black text-white tabular-nums"
        aria-live={loading ? "polite" : "off"}
      >
        {loading && (
          <span
            className="inline-block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin mr-2 align-middle"
            aria-hidden="true"
          />
        )}
        <span className={loading ? "text-white/50" : undefined}>{displayValue}</span>
      </p>

      {description && !loading && (
        <p id={descId} className="text-xs text-white/40 mt-1">
          {description}
        </p>
      )}
    </div>
  );
}
