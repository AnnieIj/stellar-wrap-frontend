"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

export interface ConnectWalletButtonProps {
  /** Human-readable wallet name, e.g. "Freighter". Used for the label and aria-label. */
  walletName: string;
  /** Icon rendered next to the label. Pass a pre-sized icon element (e.g. from lucide-react). */
  icon: ReactNode;
  /** Called when the user activates the button while it is enabled and not connecting. */
  onConnect: () => void;
  /** True while a connection attempt to this wallet is in progress. */
  isConnecting?: boolean;
  /** Disables the button regardless of connecting state (e.g. the app is offline). */
  disabled?: boolean;
  /** Label shown in place of the wallet name while `isConnecting` is true. */
  connectingLabel?: string;
}

export function ConnectWalletButton({
  walletName,
  icon,
  onConnect,
  isConnecting = false,
  disabled = false,
  connectingLabel = "Connecting...",
}: ConnectWalletButtonProps) {
  const isDisabled = disabled || isConnecting;

  return (
    <motion.button
      type="button"
      onClick={onConnect}
      disabled={isDisabled}
      className="w-full px-6 py-4 bg-transparent border-2 border-theme-primary/30 rounded-xl font-bold text-white/70 hover:text-white hover:border-theme-primary/60 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-white/70 disabled:hover:border-theme-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      aria-label={
        isConnecting
          ? `Connecting to ${walletName}`
          : `Connect with ${walletName} wallet`
      }
      aria-disabled={isDisabled}
    >
      {isConnecting ? (
        <>
          <span
            className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
          <span>{connectingLabel}</span>
        </>
      ) : (
        <>
          <span className="text-theme-primary shrink-0" aria-hidden="true">
            {icon}
          </span>
          <span>Connect with {walletName}</span>
        </>
      )}
    </motion.button>
  );
}
