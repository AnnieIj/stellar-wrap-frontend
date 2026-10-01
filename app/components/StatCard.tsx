"use client";

import { ReactNode, useId } from "react";

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
  const generatedId = useId().replace(/:/g, "");
  const cardId = id || `stat-card-${label.toLowerCase().replace(/\s+/g, "-")}-${generatedId}`;
  const labelId = `${cardId}-label`;
  const valueId = `${cardId}-value`;
  const descId = description && !loading ? `${cardId}-desc` : undefined;

  const baseClasses =
    "w-full min-w-0 rounded-2xl border p-4 sm:p-5 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-theme-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  const variantClasses: Record<StatCardVariant, string> = {
    primary: "border-foreground/10 bg-foreground/5",
    secondary: "border-foreground/5 bg-foreground/[0.02]",
  };

  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "cursor-default";

  const combinedClasses = [baseClasses, variantClasses[variant], disabledClasses, className]
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
      aria-busy={loading}
      tabIndex={disabled ? -1 : 0}
    >
      <div className="mb-2 flex items-center gap-2">
        {icon && (
          <span className="text-theme-primary" aria-hidden="true">
            {icon}
          </span>
        )}
        <span
          id={labelId}
          className="text-foreground/70 text-sm font-semibold tracking-wider uppercase"
        >
          {label}
        </span>
      </div>

      <p
        id={valueId}
        className="text-foreground text-xl font-black break-words tabular-nums sm:text-2xl"
        aria-live="polite"
      >
        {loading && (
          <span
            className="border-foreground/70 mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent align-middle motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        <span className={loading ? "text-foreground/70" : undefined}>{displayValue}</span>
      </p>

      {description && (
        <p
          id={`${cardId}-desc`}
          className={`text-foreground/70 mt-1 text-xs ${loading ? "invisible" : ""}`}
          aria-hidden={loading}
        >
          {description}
        </p>
      )}
    </div>
  );
}
