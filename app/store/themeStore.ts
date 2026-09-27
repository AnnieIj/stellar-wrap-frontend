/**
 * Zustand theme store with localStorage persistence, optimistic updates, and error rollbacks.
 *
 * Design decisions:
 * - Uses zustand/middleware `persist` with `createJSONStorage` to avoid raw
 *   `localStorage` calls scattered across the codebase.
 * - The SSR-safe storage adapter returns a no-op implementation when
 *   `window` is not defined, preventing hydration mismatches in Next.js.
 * - `setColorOptimistic` / `setModeOptimistic` apply the update immediately
 *   (optimistic) and expose a `rollback()` function so callers can revert if
 *   a follow-up async operation (e.g. server preference sync) fails.
 * - `_hydrated` flag lets `ThemeProvider` know when the persisted values have
 *   been rehydrated from localStorage, so the DOM class/CSS-var sync only runs
 *   after hydration.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeColor =
  | "green"
  | "pink"
  | "yellow"
  | "red"
  | "purple"
  | "cosmic-purple";

export type ThemeMode = "dark" | "light";

export interface ThemeColorDefinition {
  name: string;
  primary: string;
  primaryRgb: string;
  background: string;
  gradient: string;
}

/** Single source of truth for colour tokens. */
export const THEME_COLORS: Record<ThemeColor, ThemeColorDefinition> = {
  green: {
    primary: "#1DB954",
    primaryRgb: "29, 185, 84",
    background: "#191414",
    name: "Spotify Green",
    gradient: "linear-gradient(135deg, #1DB954, #1ed760)",
  },
  pink: {
    primary: "#FF6B9D",
    primaryRgb: "255, 107, 157",
    background: "#1a0f14",
    name: "Neon Pink",
    gradient: "linear-gradient(135deg, #FF6B9D, #C44569)",
  },
  yellow: {
    primary: "#FFD700",
    primaryRgb: "255, 215, 0",
    background: "#1a1714",
    name: "Electric Yellow",
    gradient: "linear-gradient(135deg, #FFD700, #FFA500)",
  },
  red: {
    primary: "#FF4444",
    primaryRgb: "255, 68, 68",
    background: "#1a0a0a",
    name: "Hot Red",
    gradient: "linear-gradient(135deg, #FF4444, #CC0000)",
  },
  purple: {
    primary: "#9D4EDD",
    primaryRgb: "157, 78, 221",
    background: "#0d0208",
    name: "Deep Purple",
    gradient: "linear-gradient(135deg, #9D4EDD, #7209B7)",
  },
  "cosmic-purple": {
    primary: "#8B5CF6",
    primaryRgb: "139, 92, 246",
    background: "#0a0416",
    name: "Cosmic Purple",
    gradient: "linear-gradient(135deg, #8B5CF6, #A78BFA, #C4B5FD)",
  },
};

/** Validated colour guard used during deserialization. */
const VALID_COLORS = new Set<ThemeColor>([
  "green",
  "pink",
  "yellow",
  "red",
  "purple",
  "cosmic-purple",
]);

function isThemeColor(value: unknown): value is ThemeColor {
  return typeof value === "string" && VALID_COLORS.has(value as ThemeColor);
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light";
}

/** Rollback handle returned by optimistic update actions. */
export interface ThemeRollback {
  rollback: () => void;
}

interface ThemeStoreState {
  color: ThemeColor;
  mode: ThemeMode;
  /** True once the persisted state has been rehydrated from localStorage. */
  _hydrated: boolean;

  /**
   * Optimistically sets the colour theme.
   * Returns a `rollback()` function that restores the previous value on error.
   */
  setColorOptimistic: (color: ThemeColor) => ThemeRollback;

  /**
   * Optimistically sets the dark/light mode.
   * Returns a `rollback()` function that restores the previous value on error.
   */
  setModeOptimistic: (mode: ThemeMode) => ThemeRollback;

  /** Convenience toggle that applies an optimistic update. */
  toggleMode: () => ThemeRollback;
}

/** SSR-safe localStorage adapter: no-ops on the server. */
const ssrSafeStorage = createJSONStorage<{ color: ThemeColor; mode: ThemeMode }>(
  () =>
    typeof window !== "undefined"
      ? localStorage
      : {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        },
);

export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set, get) => ({
      color: "green",
      mode: "dark",
      _hydrated: false,

      setColorOptimistic(newColor) {
        const previousColor = get().color;
        // Apply immediately (optimistic)
        set({ color: newColor });
        return {
          rollback: () => set({ color: previousColor }),
        };
      },

      setModeOptimistic(newMode) {
        const previousMode = get().mode;
        set({ mode: newMode });
        return {
          rollback: () => set({ mode: previousMode }),
        };
      },

      toggleMode() {
        const nextMode = get().mode === "dark" ? "light" : "dark";
        return get().setModeOptimistic(nextMode);
      },
    }),
    {
      name: "stellar-theme",
      storage: ssrSafeStorage,
      /**
       * Only persist the user-facing preferences, not the internal
       * `_hydrated` flag.
       */
      partialize: (state) => ({
        color: state.color,
        mode: state.mode,
      }),
      /**
       * Validate the persisted data before applying it.
       * Falls back to defaults if the stored values are invalid/corrupted.
       */
      merge: (persisted, current) => {
        const raw = persisted as Partial<{ color: unknown; mode: unknown }>;
        return {
          ...current,
          color: isThemeColor(raw?.color) ? raw.color : current.color,
          mode: isThemeMode(raw?.mode) ? raw.mode : current.mode,
          _hydrated: true,
        };
      },
      /**
       * Mark store as hydrated once zustand-persist has finished reading
       * from localStorage. This fires after the first client render.
       */
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hydrated = true;
        }
      },
    },
  ),
);
