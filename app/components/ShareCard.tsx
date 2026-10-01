"use client";

/**
 * ShareCard — public entry point (unchanged interface for all callers).
 *
 * This component is intentionally thin: it wires together stores, hooks, and
 * event handlers, then delegates all rendering to the three sub-components:
 *
 *   CardPreview   — animated share-card visual (left panel)
 *   MintSection   — Mint button + confirmation progress + timeout banner
 *   ShareActions  — "SHARE YOUR WRAP" heading + all download/share buttons
 *
 * Pure logic (getMintButtonText, buildShareText, getExplorerUrl) lives in
 * ./shareCard/shareCardUtils.ts and is covered by unit tests there.
 */

import { motion } from "motion/react";
import { useState, RefObject, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { downloadShareImage } from "../utils/imageExport";
import {
  downloadAnimatedGif,
  downloadAnimatedVideo,
  ShareAnimationData,
  AnimationExportProgress,
} from "../utils/animationExport";
import { useWrapStore } from "@/app/store/wrapStore";
import { useTransactionStore } from "@/app/store/transactionStore";
import { useSound } from "../hooks/useSound";
import { SOUND_NAMES } from "../utils/soundManager";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useTheme } from "@/app/context/ThemeContext";
import { mintWrap } from "../utils/walletKit";

import { CardPreview } from "./shareCard/CardPreview";
import { MintSection } from "./shareCard/MintSection";
import { ShareActions } from "./shareCard/ShareActions";
import {
  getMintButtonText,
  buildShareText,
  getExplorerUrl,
} from "./shareCard/shareCardUtils";

// ---------------------------------------------------------------------------
// Public props interface — callers are unaffected by the refactor.
// ---------------------------------------------------------------------------

export interface ShareCardProps {
  username: string;
  transactions: number;
  persona: string;
  topVibe: string;
  vibePercentage: number;
  shareImageRef: RefObject<HTMLDivElement>;
  themeColor?: string;
  cardFormat?: "square" | "stories";
  onFormatChange?: (format: "square" | "stories") => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShareCard({
  username,
  transactions,
  persona,
  topVibe,
  vibePercentage,
  shareImageRef,
  themeColor = "rgb(5, 64, 32)",
  cardFormat = "square",
  onFormatChange,
}: ShareCardProps) {
  const t = useTranslations("ShareCard");

  // ---- state ---------------------------------------------------------------
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [usedMainThreadFallback, setUsedMainThreadFallback] = useState(false);
  const [exportLabel, setExportLabel] = useState<string | null>(null);
  const [exportProgress, setExportProgress] =
    useState<AnimationExportProgress | null>(null);

  // ---- stores / hooks -------------------------------------------------------
  const { address, network, period } = useWrapStore();
  const { mode } = useTheme();
  const { playSound } = useSound();
  const isOnline = useOnlineStatus();

  const {
    transactionState,
    transactionHash,
    transactionError,
    resetTransaction,
    confirmingAttempt,
    confirmingTimedOut,
    setConfirmingAttempt,
    setConfirmingTimedOut,
  } = useTransactionStore();

  // ---- side-effects --------------------------------------------------------

  /** Show a toast when the mint succeeds or fails. */
  useEffect(() => {
    if (transactionState === "confirmed" && transactionHash) {
      playSound(SOUND_NAMES.MINT_SUCCESS);
      toast.success(t("mintedSuccessfully"), {
        description: t("viewTransaction"),
        action: {
          label: t("view"),
          onClick: () =>
            window.open(
              getExplorerUrl("tx", transactionHash, "testnet"),
              "_blank",
            ),
        },
      });
    }

    if (transactionState === "failed" && transactionError) {
      console.error("[ShareCard] mint failed", { transactionError });
      toast.error(t("mintingFailed"), {
        description: transactionError,
      });
    }
  }, [transactionState, transactionHash, transactionError, playSound, t]);

  // ---- handlers ------------------------------------------------------------

  const handleDownload = async () => {
    if (!shareImageRef.current || isDownloading) return;

    setIsDownloading(true);
    setDownloadError(null);
    setUsedMainThreadFallback(false);

    const element = shareImageRef.current;
    try {
      // Never throws: falls back native share → download → OG image link.
      const outcome = await shareImageWithFallback({
        render: async () => {
          const result = await renderShareImage(element, {
            onFallbackWarning: () => setUsedMainThreadFallback(true),
            format: cardFormat,
          });
          log.info(
            `Share image generated in ${result.durationMs}ms (scale: ${result.scale}x, worker: ${result.usedWorker})`,
          );
          return result;
        },
        download: downloadImageBlob,
        preview: { username, transactions, persona, topVibe, vibePercentage },
        preferNativeShare: isMobileDevice(),
      });
      console.info(
        `Share image generated in ${result.durationMs}ms (scale: ${result.scale}x, worker: ${result.usedWorker})`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate share image";
      setDownloadError(message);
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const animationData: ShareAnimationData = {
    username,
    transactions,
    persona,
    topVibe,
    vibePercentage,
    themeColor,
  };

  const handleAnimatedExport = async (
    type: "gif" | "video",
    label: string,
  ) => {
    setExportLabel(label);
    setExportProgress({
      phase: "capturing",
      progress: 0,
      message: t("starting"),
    });
    setIsDownloading(true);
    try {
      const onProgress = (p: AnimationExportProgress) =>
        setExportProgress(p);
      const fallback = shareImageRef.current ?? undefined;

      if (type === "gif") {
        await downloadAnimatedGif(animationData, onProgress, fallback);
        toast.success(t("gifDownloaded"), {
          description: t("gifDescription"),
        });
      } else {
        await downloadAnimatedVideo(animationData, onProgress, fallback);
        toast.success(t("videoDownloaded"), {
          description: t("videoDescription"),
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("exportFailed");
      if (msg.includes("PNG")) {
        toast.info(t("staticPng"), { description: msg });
      } else {
        toast.error(t("animationExportFailed"), { description: msg });
        if (shareImageRef.current) {
          await downloadShareImage(shareImageRef.current);
        }
      }
    } finally {
      setIsDownloading(false);
      setExportProgress(null);
      setExportLabel(null);
    }
  };

  const handleShareX = async () => {
    const text = buildShareText(persona, transactions);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, "_blank", "width=600,height=500");
  };

  const handleMint = async () => {
    if (!isOnline) {
      toast.error(t("mintingOffline"));
      return;
    }

    if (!address) {
      toast.error(t("connectWalletFirst"), {
        action: {
          label: t("connectWallet"),
          onClick: () => (window.location.href = "/connect"),
        },
      });
      return;
    }

    if (transactionState === "failed" || transactionState === "confirmed") {
      resetTransaction();
      setConfirmingAttempt(null);
      setConfirmingTimedOut(false);
    }

    const observer = (state: string, data?: unknown) => {
      // Track per-tick confirming progress
      if (
        state === "submitted" &&
        data &&
        typeof data === "object" &&
        "confirming" in data
      ) {
        const d = data as unknown as {
          attempt: number;
          maxAttempts: number;
        };
        setConfirmingAttempt(d.attempt);
        return;
      }

      // Structured timeout payload
      if (
        state === "failed" &&
        data &&
        typeof data === "object" &&
        "code" in data &&
        (data as { code: string }).code === "CONFIRMATION_TIMEOUT"
      ) {
        setConfirmingTimedOut(true);
        setConfirmingAttempt(null);
      }

      // Simulation result
      if (
        state === "simulating" &&
        data &&
        typeof data === "object" &&
        "simulation" in data
      ) {
        const simulation = (
          data as {
            simulation: { success?: boolean; estimatedFee?: number };
          }
        ).simulation;
        if (simulation?.success && simulation?.estimatedFee) {
          toast.info(t("transactionSimulationSuccessful"), {
            description: t("estimatedFee", {
              fee: simulation.estimatedFee.toFixed(7),
            }),
          });
        }
      }
    };

    try {
      await mintWrap({
        userAddress: address,
        network: network || "testnet",
        period,
        archetype: persona,
        observer,
      });
    } catch (error) {
      console.error("Minting process caught error:", error);
    }
  };

  // ---- derived values passed to sub-components ----------------------------

  const mintButtonLabel = getMintButtonText(transactionState, t, {
    confirmingAttempt,
    confirmingTimedOut,
    isOnline,
  });

  // ---- render --------------------------------------------------------------

  return (
    <div
      className="relative w-full h-full overflow-hidden flex items-center justify-center transition-colors duration-200"
      style={{
        backgroundColor:
          mode === "dark"
            ? "var(--color-theme-background)"
            : "#ffffff",
      }}
    >
      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            mode === "dark"
              ? "rgba(0,0,0,0.6)"
              : "rgba(255,255,255,0.8)",
        }}
      />

      {/* Diagonal lines pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 20px,
                rgba(var(--color-theme-primary-rgb), 0.5) 20px,
                rgba(var(--color-theme-primary-rgb), 0.5) 21px
              )
            `,
          }}
        />
      </div>

      {/* Ambient glow */}
      <motion.div
        className="absolute w-150 h-150 rounded-full blur-[150px]"
        style={{
          backgroundColor: "rgba(var(--color-theme-primary-rgb), 0.2)",
        }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Two-column layout */}
      <div className="relative z-10 w-full px-3 sm:px-4 md:px-6 lg:px-12 py-4 sm:py-6 md:py-8 flex flex-col lg:flex-row items-center justify-center gap-6 sm:gap-8 md:gap-12 lg:gap-16 max-w-7xl mx-auto">
        {/* Left — card preview + mint */}
        <div className="w-full lg:flex-1 flex flex-col items-center">
          <CardPreview
            username={username}
            transactions={transactions}
            persona={persona}
            topVibe={topVibe}
            vibePercentage={vibePercentage}
          />

          <MintSection
            transactionState={transactionState}
            transactionHash={transactionHash}
            confirmingAttempt={confirmingAttempt}
            confirmingTimedOut={confirmingTimedOut}
            isOnline={isOnline}
            network={network || "testnet"}
            mintButtonLabel={mintButtonLabel}
            onMint={handleMint}
          />

          {/* View full history link */}
          {address && (
            <motion.a
              href={getExplorerUrl("account", address, network || "testnet")}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
            >
              View full history on Stellar.expert →
            </motion.a>
          )}
        </div>

        {/* Right — share actions */}
        <div className="flex-1">
          <ShareActions
            isDownloading={isDownloading}
            exportLabel={exportLabel}
            exportProgress={exportProgress}
            downloadError={downloadError}
            usedMainThreadFallback={usedMainThreadFallback}
            cardFormat={cardFormat}
            onFormatChange={onFormatChange}
            onShareX={handleShareX}
            onDownloadGif={() => handleAnimatedExport("gif", "GIF")}
            onDownloadVideo={() => handleAnimatedExport("video", "Video")}
            onDownloadImage={handleDownload}
          />
        </div>
      </div>
    </div>
  );
}
