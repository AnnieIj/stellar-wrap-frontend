"use client";

import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/app/context/ThemeContext";

/**
 * DarkLightToggle
 *
 * Toggles between dark and light mode via the Zustand theme store.
 * Uses an optimistic update so the UI responds instantly; the store also
 * persists the preference to localStorage via the persist middleware.
 *
 * Styling is handled exclusively through global CSS classes defined in
 * `globals.css` — no inline `style` props are used.
 */
export function DarkLightToggle() {
  const { mode, toggleMode } = useTheme();

  const handleToggle = () => {
    // The returned `rollback` can be called if a follow-up server operation
    // fails — e.g. syncing the preference to a user profile endpoint.
    const { rollback: _rollback } = toggleMode();
    // Currently there is no remote sync, so we intentionally ignore rollback.
    // When a server sync is added, wire it up here:
    //   syncThemePreference(nextMode).catch(() => _rollback());
  };

  return (
    <motion.button
      onClick={handleToggle}
      className="w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-lg transition-colors theme-toggle-btn theme-toggle-bg"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
      aria-pressed={mode === "dark"}
    >
      {mode === "dark" ? (
        <Sun className="w-5 h-5 text-white" aria-hidden="true" />
      ) : (
        <Moon className="w-5 h-5 text-black" aria-hidden="true" />
      )}
    </motion.button>
  );
}
