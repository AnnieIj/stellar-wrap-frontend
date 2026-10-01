import type { ReactNode } from 'react';

/**
 * Loading layout for the Liquidity Pool route.
 *
 * Renders an accessible, theme-aware shimmer skeleton while the
 * Liquidity Pool data is being fetched, preventing a blank screen
 * and minimizing layout shift (CLS).
 */
export default function LoadingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading liquidity pool data"
      className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
    >
      <span className="sr-only">Loading liquidity pool data…</span>

      {/* Header skeleton */}
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted sm:h-9 sm:w-64" />
        <div className="h-10 w-full animate-pulse rounded-md bg-muted sm:w-40" />
      </div>

      {/* Summary cards skeleton */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-7 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Pool list skeleton */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="hidden grid-cols-4 gap-4 border-b border-border p-4 sm:grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-4 w-20 animate-pulse rounded bg-muted"
            />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4"
            >
              {Array.from({ length: 4 }).map((_, colIndex) => (
                <div
                  key={colIndex}
                  className="h-5 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
