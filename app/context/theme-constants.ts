/**
 * theme-constants.ts
 *
 * Backwards-compatible re-export shim.
 * The authoritative definitions live in `app/store/themeStore.ts`.
 * Importing from here keeps existing consumers working without changes.
 */

export type { ThemeColor, ThemeMode, ThemeColorDefinition } from "@/app/store/themeStore";
export { THEME_COLORS as themeColors } from "@/app/store/themeStore";
