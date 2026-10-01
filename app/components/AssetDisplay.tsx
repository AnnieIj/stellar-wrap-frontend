"use client";

/**
 * AssetDisplay Component
 * Displays resolved asset with logo, name, and code.
 * Uses React Query (useAssetQuery) for caching and retry logic.
 */

import React, { useState, useEffect } from "react";
import { AssetMetadata } from "@/app/types/asset";
import {
  getAssetDisplayName,
  getAssetShortName,
} from "@/app/services/assetResolver";
import { useAssetQuery } from "@/app/hooks/useAssetQuery";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";

const ASSET_METADATA_CACHE_KEY = "asset-display-metadata-cache-v1";

const ASSET_LIST_CACHE_KEY = "asset-list-state-v1";

export interface CachedAssetRef {
  code: string;
  issuer?: string;
}

function assetCacheKey(code: string, issuer?: string): string {
  return issuer ? `${code}:${issuer}` : `${code}:native`;
}

function loadAssetMetadataCache(): Record<string, AssetMetadata> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(ASSET_METADATA_CACHE_KEY);
    if (!raw) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, AssetMetadata>;
    }

    return {};
  } catch {
    return {};
  }
}

function cacheAssetMetadata(
  code: string,
  issuer: string | undefined,
  metadata: AssetMetadata,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const cache = loadAssetMetadataCache();
    cache[assetCacheKey(code, issuer)] = metadata;
    window.localStorage.setItem(
      ASSET_METADATA_CACHE_KEY,
      JSON.stringify(cache),
    );
    cacheAssetInList(code, issuer);
  } catch {
    // Silently ignore storage failures (private mode, quota exceeded).
  }
}

export function loadAssetListState(): CachedAssetRef[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ASSET_LIST_CACHE_KEY);
    if (!raw) {
      return Object.keys(loadAssetMetadataCache()).map((key) => {
        const separatorIndex = key.lastIndexOf(":");
        if (separatorIndex === -1) {
          return { code: key };
        }

        const code = key.slice(0, separatorIndex);
        const issuer = key.slice(separatorIndex + 1);
        return issuer === "native" ? { code } : { code, issuer };
      });
    }

    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CachedAssetRef[]) : [];
  } catch {
    return [];
  }
}

export function saveAssetListState(assets: CachedAssetRef[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ASSET_LIST_CACHE_KEY, JSON.stringify(assets));
  } catch {
    // Silently ignore storage failures (private mode, quota exceeded).
  }
}

/**
 * Hook that persists the asset list state to localStorage across sessions.
 */
export function useAssetListState() {
  const [assets, setAssets] = useState<CachedAssetRef[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAssets(loadAssetListState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      saveAssetListState(assets);
    }
  }, [assets, hydrated]);

  return [assets, setAssets] as const;
}

function cacheAssetInList(code: string, issuer?: string): void {
  const list = loadAssetListState();
  const key = assetCacheKey(code, issuer);
  const exists = list.some(
    (entry) => assetCacheKey(entry.code, entry.issuer) === key,
  );

  if (!exists) {
    list.push(issuer === undefined ? { code } : { code, issuer });
  }
  saveAssetListState(list);
}

interface AssetDisplayProps {
  code: string;
  issuer?: string;
  showLogo?: boolean;
  showCode?: boolean;
  showFullName?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  logoClassName?: string;
}

/**
 * Size configurations for different display sizes
 */
const SIZE_CONFIGS = {
  sm: { logo: 16, text: "text-xs" },
  md: { logo: 24, text: "text-sm" },
  lg: { logo: 32, text: "text-base" },
};

export type AssetCardVariant = "primary" | "secondary" | "disabled" | "loading";

const CARD_VARIANTS: Record<AssetCardVariant, string> = {
  primary: "bg-gray-100 dark:bg-gray-800",
  secondary:
    "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700",
  disabled: "bg-gray-100 dark:bg-gray-800",
  loading: "bg-gray-100 dark:bg-gray-800",
};

const CARD_INTERACTION_CLASSES =
  "cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:shadow-sm";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Produce a 1- or 2-letter abbreviation for a given asset code. */
function assetInitials(code: string): string {
  const clean = code.replace(/[^a-zA-Z0-9]/g, "");
  return (clean.slice(0, 2) || "??").toUpperCase();
}

/**
 * Deterministic background colour derived from the asset code so the same
 * asset always gets the same colour, which looks intentional rather than
 * random.
 */
const INITIALS_BG_CLASSES: string[] = [
  "bg-red-800",
  "bg-orange-800",
  "bg-amber-800",
  "bg-green-800",
  "bg-teal-800",
  "bg-blue-800",
  "bg-indigo-800",
  "bg-purple-800",
  "bg-pink-800",
  "bg-gray-800",
];

function initialsColor(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }
  return INITIALS_BG_CLASSES[hash % INITIALS_BG_CLASSES.length] ?? "bg-gray-800";
}

/** Fixed Tailwind size classes for the three supported icon slot sizes. */
function iconSizeClass(size: number): string {
  if (size === 16) {
    return "h-4 w-4";
  }
  if (size === 24) {
    return "h-6 w-6";
  }
  return "h-8 w-8";
}

/** Fixed Tailwind font-size class for initials inside an icon slot. */
function initialsSizeClass(size: number): string {
  if (size === 16) {
    return "text-[8px]";
  }
  if (size === 24) {
    return "text-[9px]";
  }
  return "text-[12px]";
}

interface InitialsBadgeProps {
  code: string;
  size: number;
  className?: string;
  decorative?: boolean;
  alt?: string;
}

/**
 * A compact, always-visible initials badge that occupies exactly the same
 * dimensions as the <Image> it replaces, so the layout never shifts.
 */
const InitialsBadge: React.FC<InitialsBadgeProps> = ({
  code,
  size,
  className = "",
  decorative = false,
  alt,
}) => (
  <span
    role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : alt || `${code} icon`}
    aria-hidden={decorative || undefined}
    className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${iconSizeClass(size)} ${initialsSizeClass(size)} ${initialsColor(code)} ${className}`}
  >
    {assetInitials(code)}
  </span>
);

// ---------------------------------------------------------------------------
// AssetIconSlot — always reserves fixed dimensions; shows image or fallback
// ---------------------------------------------------------------------------

interface AssetIconSlotProps {
  logo: string | undefined;
  code: string;
  size: number;
  className?: string;
  alt?: string;
}

/**
 * Renders the icon at a fixed size regardless of load/error state.
 *
 * States:
 *  1. logo present & loads OK   → <Image>
 *  2. logo present & fails      → <InitialsBadge> (same dimensions)
 *  3. no logo                   → <InitialsBadge> immediately
 */
const AssetIconSlot: React.FC<AssetIconSlotProps> = ({
  logo,
  code,
  size,
  className = "",
  alt,
}) => {
  const [imgError, setImgError] = useState(false);

  // If the logo URL changes, reset the error flag
  useEffect(() => {
    setImgError(false);
  }, [logo]);

  if (!logo || imgError) {
    return (
      <InitialsBadge
        code={code}
        size={size}
        className={className}
        decorative={alt === ""}
        alt={alt || undefined}
      />
    );
  }

  return (
    <Image
      src={logo}
      alt={alt ?? code}
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${iconSizeClass(size)} ${className}`}
      onError={() => setImgError(true)}
    />
  );
};

// ---------------------------------------------------------------------------
// AssetDisplay
// ---------------------------------------------------------------------------

/**
 * AssetDisplay component
 * Resolves and displays asset metadata with logo and name.
 */
export const AssetDisplay: React.FC<AssetDisplayProps> = ({
  code,
  issuer,
  showLogo = true,
  showCode = true,
  showFullName = true,
  size = "md",
  className = "",
  logoClassName = "",
}) => {
  const sizeConfig = SIZE_CONFIGS[size];

  const { data: metadata, isLoading, error } = useQuery({
    queryKey: ['asset', code, issuer],
    queryFn: () => resolveAsset(code, issuer),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });

  // Loading state — icon slot is a pulse skeleton at the reserved dimensions
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className={`animate-pulse rounded-full bg-gray-200 dark:bg-gray-700 h-[${sizeConfig.logo}px] w-[${sizeConfig.logo}px]`}
        />
        {showCode && (
          <span className={`${sizeConfig.text} text-gray-600 dark:text-gray-400`}>Loading...</span>
        )}
      </div>
    );
  }

  // Error / unresolved state — still reserve the icon slot to prevent shift
  if (error || !metadata) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showLogo && (
          <InitialsBadge
            code={code}
            size={sizeConfig.logo}
            className={logoClassName}
            decorative={showCode}
          />
        )}
        {showCode && (
          <span
            className={`${sizeConfig.text} min-w-0 truncate text-gray-600 dark:text-gray-400`}
          >
            {code}
          </span>
        )}
      </div>
    );
  }

  const displayName = showFullName
    ? getAssetDisplayName(metadata)
    : getAssetShortName(metadata);
  const logoAlt = displayName
    .toLowerCase()
    .includes(metadata.code.toLowerCase())
    ? ""
    : metadata.code;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLogo && (
        <AssetIconSlot
          logo={metadata.logo}
          code={metadata.code}
          size={sizeConfig.logo}
          className={logoClassName}
          alt={logoAlt}
        />
      )}
      <span
        className={`${sizeConfig.text} min-w-0 truncate font-medium text-gray-900 dark:text-gray-100`}
      >
        {displayName}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// AssetBadge
// ---------------------------------------------------------------------------

/**
 * Compact asset display (code only with optional logo)
 */
export const AssetBadge: React.FC<Omit<AssetDisplayProps, "showFullName">> = (
  props,
) => {
  return (
    <AssetDisplay {...props} showFullName={false} size={props.size || "sm"} />
  );
};

// ---------------------------------------------------------------------------
// AssetCard
// ---------------------------------------------------------------------------

/**
 * Asset display with full metadata and a stable icon slot.
 */
export const AssetCard: React.FC<
  AssetDisplayProps & { showIssuer?: boolean }
> = ({ showIssuer = false, ...props }) => {
  const { data: metadata, isLoading } = useQuery({
    queryKey: ['asset', props.code, props.issuer],
    queryFn: () => resolveAsset(props.code, props.issuer),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });

  if (isLoading) {
    return (
      <div
        className={cardClassName}
        role={interactive ? "button" : isLoadingOrProp ? "status" : undefined}
        tabIndex={interactive && !resolvedDisabled ? 0 : undefined}
        aria-disabled={interactive && resolvedDisabled ? true : undefined}
        aria-busy={isLoadingOrProp ? true : undefined}
        aria-label={isLoadingOrProp ? "Loading asset" : undefined}
        onClick={interactive && !resolvedDisabled ? onClick : undefined}
        onKeyDown={
          interactive && !resolvedDisabled
            ? (event: React.KeyboardEvent<HTMLDivElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
      >
        {children}
      </div>
    );
  };

  if (isLoadingOrProp) {
    return cardContent(
      <>
        {/* Icon skeleton — fixed 32×32 so the layout doesn't shift */}
        {showLogo && (
          <div
            aria-hidden="true"
            className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-gray-300 dark:bg-gray-600"
          />
        )}
        <div className="space-y-1">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-300 dark:bg-gray-600" />
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </>,
    );
  }

  if (!metadata) {
    return cardContent(
      <>
        {/* Reserve the icon slot even for the fallback state */}
        {showLogo && (
          <InitialsBadge code={props.code} size={32} />
        )}
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {props.code}
        </span>
      </>,
    );
  }

  return cardContent(
    <>
      {showLogo && (
        <AssetIconSlot logo={metadata.logo} code={metadata.code} size={32} />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-gray-900 dark:text-gray-100">
          {metadata.name}
        </div>
        <div className="truncate text-xs text-gray-600 dark:text-gray-400">
          {metadata.code}
          {showIssuer && metadata.issuer && (
            <span className="ml-2">({metadata.issuer.slice(0, 8)}...)</span>
          )}
        </div>
        {metadata.description && (
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {metadata.description}
          </div>
        )}
      </div>
    </>,
  );
};

const meta = {
  title: "Components/AssetCard",
  component: AssetCard,
  parameters: {
    layout: "centered",
    viewport: {
      viewports: {
        mobile: { name: "Mobile", styles: { width: "375px", height: "667px" } },
        tablet: { name: "Tablet", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop", styles: { width: "1280px", height: "800px" } },
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["primary", "secondary", "disabled", "loading"],
    },
    showIssuer: { control: "boolean" },
    disabled: { control: "boolean" },
    loading: { control: "boolean" },
  },
} satisfies Meta<typeof AssetCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    code: "USD",
    issuer: "GA5X",
    variant: "primary",
    showIssuer: true,
  },
};

export const Mobile: Story = {
  args: {
    ...Primary.args,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile",
    },
  },
};

export const Tablet: Story = {
  args: {
    ...Primary.args,
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};

export const Desktop: Story = {
  args: {
    ...Primary.args,
  },
  parameters: {
    viewport: {
      defaultViewport: "desktop",
    },
  },
};

export const DarkMode: Story = {
  args: {
    ...Primary.args,
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <Story />
      </div>
    ),
  ],
};

export const Secondary: Story = {
  args: {
    code: "EUR",
    issuer: "GBY",
    variant: "secondary",
    showIssuer: true,
  },
};

export const Disabled: Story = {
  args: {
    code: "BTC",
    issuer: "GABC",
    variant: "disabled",
    disabled: true,
    onClick: () => undefined,
  },
};

export const Loading: Story = {
  args: {
    code: "XRP",
    issuer: "GXYZ",
    variant: "loading",
    loading: true,
  },
};

export const Interactive: Story = {
  args: {
    code: "ETH",
    issuer: "GETH",
    variant: "primary",
    onClick: () => undefined,
  },
};
