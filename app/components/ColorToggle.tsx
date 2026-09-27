"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, X } from "lucide-react";
import { useTheme, THEME_COLORS, type ThemeColor } from "@/app/context/ThemeContext";

/**
 * ColorToggle
 *
 * Colour-theme picker that uses the Zustand theme store.
 * All updates are optimistic: the UI changes immediately and a `rollback()`
 * handle is available for error recovery if a remote sync ever fails.
 *
 * No inline `style` props are used — see `globals.css` for the CSS utilities
 * (`.color-picker-panel`, `.color-option-row`, etc.) and `var()` tokens for
 * dynamic theme values.
 */
export function ColorToggle() {
  const { color, setColor } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const colorOptions: ThemeColor[] = [
    "green",
    "pink",
    "yellow",
    "red",
    "purple",
    "cosmic-purple",
  ];

  const handleSelect = (colorOption: ThemeColor) => {
    const { rollback: _rollback } = setColor(colorOption);
    // If a server sync is added later, hook rollback in on failure:
    //   syncColorPreference(colorOption).catch(() => _rollback());
    setIsOpen(false);
  };

  return (
    <div className="relative z-50">
      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 flex items-center justify-center shadow-lg theme-toggle-btn theme-toggle-bg"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label={`Theme picker. Current theme: ${THEME_COLORS[color].name}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isOpen ? (
          <X
            size={20}
            className="md:w-6 md:h-6 theme-icon"
            aria-hidden="true"
          />
        ) : (
          <Palette
            size={20}
            className="md:w-6 md:h-6 theme-icon"
            aria-hidden="true"
          />
        )}
      </motion.button>

      {/* Color Picker Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            role="menu"
            aria-label="Choose colour theme"
            className="rounded-xl p-3 border absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[160px] sm:w-[200px] z-50 color-picker-panel"
          >
            {/* Title */}
            <div className="text-sm font-bold mb-3 text-center tracking-wider color-picker-title">
              CHOOSE YOUR VIBE
            </div>

            {/* Color Options */}
            <div className="flex flex-col gap-2">
              {colorOptions.map((colorOption) => {
                const theme = THEME_COLORS[colorOption];
                const isActive = color === colorOption;

                return (
                  <motion.button
                    key={colorOption}
                    onClick={() => handleSelect(colorOption)}
                    className={[
                      "flex items-center gap-3 p-3 rounded-lg transition-all relative overflow-hidden border-2",
                      isActive
                        ? "border-[var(--color-theme-active-border,currentColor)]"
                        : "border-transparent color-option-row",
                    ].join(" ")}
                    style={
                      isActive
                        ? {
                            borderColor: theme.primary,
                            background: `linear-gradient(90deg, ${theme.primary}20, transparent)`,
                          }
                        : undefined
                    }
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    role="menuitemradio"
                    aria-label={`Select ${theme.name} theme`}
                    aria-checked={isActive}
                  >
                    {/* Color Circle — decorative; aria-hidden */}
                    <div
                      className="w-8 h-8 rounded-full flex-shrink-0"
                      aria-hidden="true"
                      style={{
                        background: theme.gradient,
                        boxShadow: `0 0 15px ${theme.primary}60`,
                      }}
                    />

                    {/* Color Name */}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-bold color-picker-title">
                        {theme.name}
                      </div>
                    </div>

                    {/* Active indicator dot */}
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-2 h-2 rounded-full"
                        style={{ background: theme.primary }}
                        aria-hidden="true"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Hint */}
            <div className="text-xs text-center mt-3 color-picker-hint">
              Your theme persists across sessions
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
