import React from "react";
import type { AssetMetadata } from "../types/asset";

export type AssetCardVariant = "primary" | "secondary";

export interface AssetCardProps {
  asset: AssetMetadata;
  variant?: AssetCardVariant;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: (asset: AssetMetadata) => void;
  className?: string;
}


const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  variant = "primary",
  selected = false,
  disabled = false,
  loading = false,
  onClick,
  className = "",
}) => {
  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      onClick(asset);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  const cardClasses = [
    "group",
    "relative",
    "flex",
    "w-full",
    "items-center",
    "gap-4",
    "rounded-lg",
    "border",
    "p-4",
    "text-left",
    "focus:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-[var(--color-theme-primary)]",
    "focus-visible:border-[var(--color-theme-primary)]",
    "transition-all",
    "duration-200",
    "ease-in-out",
    variant === "primary" ? (disabled
      ? "border-[var(--color-theme-primary)] bg-[var(--color-theme-background)]"
      : "border-[var(--color-theme-primary)] bg-[var(--color-theme-background)] hover:border-[var(--color-theme-primary)] hover:shadow-md")
      : (disabled
        ? "border-gray-300 bg-transparent"
        : "border-gray-300 bg-transparent hover:border-[var(--color-theme-primary)] hover:bg-[rgba(var(--color-theme-primary-rgb),0.05)]"),
    selected ? "ring-2 ring-[var(--color-theme-primary)]" : "",
    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
    loading ? "pointer-events-none" : "",
    !disabled && !loading ? "active:scale-[.98]" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const iconWrapperClasses = [
    "flex",
    "h-12",
    "w-12",
    "shrink-0",
    "items-center",
    "justify-center",
    "rounded-lg",
    "bg-[rgba(var(--color-theme-primary-rgb),0.2)]",
    "font-semibold",
    "text-[var(--color-theme-primary)]",
  ]
    .join(" ");

  if (loading) {
    return (
      <div
        className={cardClasses}
        role="button"
        tabIndex={-1}
        aria-disabled="true"
        aria-busy="true"
      >
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-gray-300" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-300" />
          <div className="h-3 w-16 animate-pulse rounded bg-gray-300" />
        </div>
        <span className="sr-only">Loading asset card</span>
      </div>
    );
  }

  const showLogo = Boolean(asset.logo && asset.logo.length > 0);

  return (
    <div
      className={cardClasses}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-pressed={selected}
      aria-label={" ${asset.name} (${asset.code})"}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {showLogo ? (
        <img
          src={asset.logo}
          alt={"${asset.code} logo"}
          className="h-12 w-12 shrink-0 rounded-lg object-contain"
          loading="lazy"
        />
      ) : (
        <span className={showLogo ? "iconWrapperClasses" : "iconWrapperClasses"} aria-hidden="true">
          {asset.code.charAt(0)}
        </span>
      )
      }
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[var(--color-foreground)]">
          {asset.name}
        </p>
        <p className="truncate text-sm text-[var(--color-foreground)]/70">
          {asset.code}
          {asset.issuer ? ` ${asset.issuer}` : ""}
        </p>
        {asset.domain && (
          <p className="truncate text-xs text-[var(--color-foreground)]/50">
            {asset.domain}
          </p>
        )}
      </div>
      {selected && (
        <span
          className="flex h-5 w-5 shrink-0 rounded-full bg-[var(--color-theme-primary)] text-white text-sm font-bold"
          aria-label="Selected"
          role="img"
        >
          ℓ
        </span>
      )
      }
    </div>
  );
};

export default AssetCard;
