/**
 * Hook for executing Asset Trustline Creation with optimistic UI updates,
 * automated error rollback, and user notifications.
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useTrustlineStore } from "../store/trustlineStore";
import { createAssetTrustline, parseTrustlineError } from "../services/trustlineService";
import { useWrapStore } from "@/app/store/wrapStore";
import { useSound } from "@/app/hooks/useSound";
import { SOUND_NAMES } from "@/app/utils/soundManager";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";
import type { TrustlineItem } from "../types/trustline";

export interface CreateTrustlineOptions {
  assetCode: string;
  assetIssuer: string;
  limit?: string;
}

export function useTrustline() {
  const { trustlines, optimisticAddTrustline, confirmTrustline, revertTrustline, removeTrustline } =
    useTrustlineStore();
  const { address, network } = useWrapStore();
  const { playSound } = useSound();
  const isOnline = useOnlineStatus();
  const [isProcessing, setIsProcessing] = useState(false);

  const addTrustline = useCallback(
    async (options: CreateTrustlineOptions): Promise<boolean> => {
      const { assetCode, assetIssuer, limit } = options;
      const code = assetCode.trim().toUpperCase();
      const issuer = assetIssuer.trim();

      if (!isOnline) {
        toast.error("Offline mode", {
          description: "Cannot create trustlines while offline.",
        });
        return false;
      }

      if (!address) {
        toast.error("Wallet not connected", {
          description: "Please connect your Freighter wallet first.",
        });
        return false;
      }

      // 1. Trigger optimistic UI update immediately
      const optimisticItem: TrustlineItem = optimisticAddTrustline(code, issuer, limit);
      setIsProcessing(true);

      const toastId = toast.loading(`Adding trustline for ${code}...`, {
        description: "Requesting wallet signature...",
      });

      try {
        // 2. Perform blockchain transaction (sign with Freighter & submit)
        const result = await createAssetTrustline({
          accountAddress: address,
          assetCode: code,
          assetIssuer: issuer,
          limit,
          network: network || "testnet",
        });

        // 3. Confirm optimistic update in store
        confirmTrustline(code, issuer, result.transactionHash);
        playSound(SOUND_NAMES.MINT_SUCCESS);

        toast.success(`Trustline created for ${code}!`, {
          id: toastId,
          description: `Transaction confirmed in ledger ${result.ledger || "N/A"}`,
          action: {
            label: "Explorer",
            onClick: () => {
              const explorerNet = network === "testnet" ? "testnet" : "public";
              window.open(
                `https://stellar.expert/explorer/${explorerNet}/tx/${result.transactionHash}`,
                "_blank"
              );
            },
          },
        });

        return true;
      } catch (error) {
        // 4. On failure / rejection: Revert the optimistic update
        const userFriendlyError = parseTrustlineError(error);
        revertTrustline(code, issuer, userFriendlyError);

        toast.error(`Trustline failed for ${code}`, {
          id: toastId,
          description: userFriendlyError,
        });

        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [
      address,
      network,
      isOnline,
      optimisticAddTrustline,
      confirmTrustline,
      revertTrustline,
      playSound,
    ]
  );

  return {
    trustlines,
    addTrustline,
    removeTrustline,
    isProcessing,
  };
}
