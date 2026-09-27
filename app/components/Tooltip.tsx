"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";
export type TooltipVariant = "primary" | "secondary" | "disabled";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: TooltipPlacement;
  variant?: TooltipVariant;
  disabled?: boolean;
  loading?: boolean;
}

const PLACEMENT_CLASSES: Record<TooltipPlacement, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const VARIANT_CLASSES: Record<TooltipVariant, string> = {
  primary: "bg-black/70 border-white/20 text-white",
  secondary: "bg-white/95 border-white text-black",
  disabled: "bg-white/5 border-white/10 text-white/40",
};

export function Tooltip({
  content,
  children,
  placement = "top",
  variant = "primary",
  disabled = false,
  loading = false,
}: TooltipProps) {
  const [visible, setVisible] = useState<boolean>(false);
  const titleId = useId();

  const show = !disabled && !loading && visible;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span aria-describedby={show ? titleId : undefined}>{children}</span>

      <AnimatePresence>
        {show && (
          <motion.div
            id={titleId}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`pointer-events-none absolute z-50 w-max max-w-xs rounded-lg border px-3 py-2 text-xs font-medium shadow-xl ${PLACEMENT_CLASSES[placement]} ${VARIANT_CLASSES[variant]}`}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {loading && !disabled && (
          <motion.div
            id={titleId}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`pointer-events-none absolute z-50 flex w-max max-w-xs items-center gap-2 rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-xs font-medium text-white shadow-xl ${PLACEMENT_CLASSES[placement]}`}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
