"use client";

import { useEffect, useState } from "react";
import { useWalletStore } from "../store/walletStore";
import { validateWalletConnection } from "../utils/walletConnect";
import { Network } from "../../src/config";

export type HydrationStatus = "idle" | "validated" | "reconnect-required";

/**
 * Re-validates a persisted wallet session on app reload so the user isn't
 * force-disconnected just because the page refreshed.
 *
 * Reads the connection persisted in `useWalletStore` and, when there is a
 * live provider session (Freighter/Albedo/xBull), confirms the wallet is still
 * reachable and on the right network — without prompting. If the wallet is
 * gone or the network changed, the session is marked `needsReconnect` so the
 * UI can offer a one-tap reconnect instead of pretending it's live.
 *
 * Safe to mount once (e.g. in the navbar shell or an app-level provider). Never
 * throws and never crashes the UI on validation failure.
 */
export function useHydrateWallet(network: Network): HydrationStatus {
  const [status, setStatus] = useState<HydrationStatus>("idle");

  useEffect(() => {
    let cancelled = false;

    const hydrate = async (): Promise<void> => {
      const { address, provider, isConnected, needsReconnect } =
        useWalletStore.getState();

      // No persisted session, or one already flagged as needing a reconnect,
      // or a manual/demo-only session — nothing live to do.
      if (!isConnected || needsReconnect || !address) {
        setStatus("idle");
        return;
      }

      const result = await validateWalletConnection(provider, address, network);

      if (cancelled) return;

      if (result.ok) {
        useWalletStore.getState().clearNeedsReconnect();
        setStatus("validated");
      } else {
        useWalletStore.getState().markNeedsReconnect();
        setStatus("reconnect-required");
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [network]);

  return status;
}
