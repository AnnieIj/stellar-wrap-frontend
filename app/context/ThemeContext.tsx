"use client";

/**
 * ThemeContext / ThemeProvider
 *
 * This module intentionally stays thin:
 *   - All persistent state lives in `useThemeStore` (Zustand + localStorage).
 *   - `ThemeProvider` is a React component whose only job is to apply DOM
 *     side-effects (CSS custom properties, `.dark` / `.light` class on
 *     `<html>`) in response to store changes.
 *   - `useTheme` is a convenience hook that re-exports the store's public API
 *     so consumers don't need to import from two places.
 *
 * SSR / hydration strategy:
 *   - The store's `_hydrated` flag is `false` on the first server render.
 *   - `ThemeProvider` uses a `useEffect` (client-only) to apply the persisted
 *     theme values, preventing a hydration mismatch.
 *   - The `<html>` element always starts with the default `dark` class from
 *     the server; any user preference is applied after mount with no visible
 *     flash because CSS custom properties are set synchronously in the effect.
 */

import React, { useEffect } from "react";
import {
  useThemeStore,
  THEME_COLORS,
  type ThemeColor,
  type ThemeMode,
  type ThemeRollback,
} from "@/app/store/themeStore";

// Re-export types so callers that imported from this file keep working.
export type { ThemeColor, ThemeMode, ThemeRollback };

// Re-export colour definitions for components that need the token values.
// `themeColors` keeps backwards compatibility; `THEME_COLORS` is the canonical name.
export { THEME_COLORS, THEME_COLORS as themeColors };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const color = useThemeStore((s) => s.color);
  const mode = useThemeStore((s) => s.mode);
  const hydrated = useThemeStore((s) => s._hydrated);

  // Apply CSS custom properties whenever the colour changes (client-only).
  useEffect(() => {
    if (!hydrated) return;
    const theme = THEME_COLORS[color];
    const root = document.documentElement;
    root.style.setProperty("--color-theme-primary", theme.primary);
    root.style.setProperty("--color-theme-primary-rgb", theme.primaryRgb);
    root.style.setProperty("--color-theme-background", theme.background);
    root.style.setProperty("--color-theme-gradient", theme.gradient);
  }, [color, hydrated]);

  // Apply dark/light class whenever the mode changes (client-only).
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [mode, hydrated]);

  return <>{children}</>;
}

/**
 * `useTheme` — primary hook for consuming theme state and actions.
 *
 * Stable reference: Zustand selectors subscribe only to the slices they read,
 * so consumers that call `useTheme()` will only re-render when `color` or
 * `mode` actually changes — not on every store write.
 */
export function useTheme(): {
  color: ThemeColor;
  mode: ThemeMode;
  setColor: (color: ThemeColor) => ThemeRollback;
  setMode: (mode: ThemeMode) => ThemeRollback;
  toggleMode: () => ThemeRollback;
} {
  const color = useThemeStore((s) => s.color);
  const mode = useThemeStore((s) => s.mode);
  const setColorOptimistic = useThemeStore((s) => s.setColorOptimistic);
  const setModeOptimistic = useThemeStore((s) => s.setModeOptimistic);
  const toggleMode = useThemeStore((s) => s.toggleMode);

  return {
    color,
    mode,
    setColor: setColorOptimistic,
    setMode: setModeOptimistic,
    toggleMode,
  };
}
