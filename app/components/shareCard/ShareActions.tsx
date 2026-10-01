"use client";

import { motion } from "motion/react";
import {
  Share2,
  Download,
  Twitter,
  Loader2,
  AlertCircle,
  Film,
  ImagePlay,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/app/context/ThemeContext";
import type { AnimationExportProgress } from "@/app/utils/animationExport";

export interface ShareActionsProps {
  /** Whether any download/export is currently in progress. */
  isDownloading: boolean;
  /** Which export label ("GIF" | "Video") is active, or null when idle. */
  exportLabel: string | null;
  /** Live progress from the active animation export, or null when idle. */
  exportProgress: AnimationExportProgress | null;
  /** Error message from the last failed PNG download, or null. */
  downloadError: string | null;
  /** True when the main-thread fallback was used (worker unavailable). */
  usedMainThreadFallback: boolean;
  /** The currently selected card format. */
  cardFormat: "square" | "stories";
  /** Called when the user switches card format. */
  onFormatChange?: (format: "square" | "stories") => void;
  /** Called when the user clicks "Share to Social" or "Post to X". */
  onShareX: () => void;
  /** Called when the user clicks "Download GIF". */
  onDownloadGif: () => void;
  /** Called when the user clicks "Download Video". */
  onDownloadVideo: () => void;
  /** Called when the user clicks "Download Image". */
  onDownloadImage: () => void;
}

/**
 * Renders the right-hand "SHARE YOUR WRAP" panel:
 *   - Heading
 *   - Square / Stories format toggle
 *   - Share-to-X, Post-to-X, GIF, Video, and static PNG buttons
 *   - Export progress bar
 *   - Download error state with retry
 *   - Main-thread-fallback notice
 */
export function ShareActions({
  isDownloading,
  exportLabel,
  exportProgress,
  downloadError,
  usedMainThreadFallback,
  cardFormat,
  onFormatChange,
  onShareX,
  onDownloadGif,
  onDownloadVideo,
  onDownloadImage,
}: ShareActionsProps) {
  const t = useTranslations("ShareCard");
  const { mode } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
    >
      {/* Heading */}
      <h3
        className="text-7xl font-black mb-1 tracking-tight leading-none"
        style={{
          color:
            mode === "dark"
              ? "rgba(255,255,255,0.9)"
              : "rgba(0,0,0,0.8)",
        }}
      >
        SHARE
      </h3>
      <h3
        className="text-8xl font-black mb-6 tracking-tight leading-none"
        style={{
          background:
            mode === "dark"
              ? `linear-gradient(to right, #ffffff, var(--color-theme-primary))`
              : `linear-gradient(to right, #1a1a1a, var(--color-theme-primary))`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        YOUR WRAP
      </h3>

      {/* Format toggle */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mb-6 flex gap-3"
      >
        <motion.button
          onClick={() => onFormatChange?.("square")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            cardFormat === "square"
              ? "bg-white text-black"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Film className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm font-bold">{t("square")}</span>
        </motion.button>
        <motion.button
          onClick={() => onFormatChange?.("stories")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            cardFormat === "stories"
              ? "bg-white text-black"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ImagePlay className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm font-bold">{t("stories")}</span>
        </motion.button>
      </motion.div>

      <div className="space-y-4">
        {/* Share to Social */}
        <motion.button
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          whileHover={{ scale: 1.05, x: 10, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          className="w-full group relative"
          onClick={onShareX}
        >
          <motion.div
            className="absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: "var(--color-theme-primary)" }}
          />
          <div className="relative flex items-center gap-4 bg-white text-black px-8 py-6 rounded-2xl border border-white/20">
            <Share2 className="w-6 h-6" aria-hidden="true" />
            <span className="text-2xl font-black tracking-tight">
              {t("shareToSocial")}
            </span>
          </div>
        </motion.button>

        {/* Post to X */}
        <motion.button
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
          whileHover={{ scale: 1.05, x: 10, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          className="w-full group relative"
          onClick={onShareX}
        >
          <motion.div
            className="absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: "var(--color-theme-primary)" }}
          />
          <div
            className="relative flex items-center gap-4 backdrop-blur-sm px-8 py-6 rounded-2xl border"
            style={{
              backgroundColor:
                mode === "dark"
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.05)",
              color: mode === "dark" ? "#ffffff" : "#1a1a1a",
              borderColor:
                mode === "dark"
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(0,0,0,0.1)",
            }}
          >
            <Twitter className="w-6 h-6" aria-hidden="true" />
            <span className="text-2xl font-black tracking-tight">
              {t("postToX")}
            </span>
          </div>
        </motion.button>

        {/* Download GIF */}
        <motion.button
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.95 }}
          whileHover={{ scale: 1.05, x: 10, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          className="w-full group relative"
          onClick={onDownloadGif}
          disabled={isDownloading}
        >
          <motion.div
            className="absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: "var(--color-theme-primary)" }}
          />
          <div
            className="relative flex items-center gap-4 backdrop-blur-sm text-white px-8 py-6 rounded-2xl border border-white/20"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
          >
            {isDownloading && exportLabel === "GIF" ? (
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlay className="w-6 h-6" aria-hidden="true" />
            )}
            <span className="text-2xl font-black tracking-tight">
              {isDownloading && exportLabel === "GIF"
                ? (exportProgress?.message ?? t("encodingGif"))
                : t("downloadGif")}
            </span>
          </div>
        </motion.button>

        {/* Download Video */}
        <motion.button
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.0 }}
          whileHover={{ scale: 1.05, x: 10, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          className="w-full group relative"
          onClick={onDownloadVideo}
          disabled={isDownloading}
        >
          <motion.div
            className="absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: "var(--color-theme-primary)" }}
          />
          <div
            className="relative flex items-center gap-4 backdrop-blur-sm text-white px-8 py-6 rounded-2xl border border-white/20"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
          >
            {isDownloading && exportLabel === "Video" ? (
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            ) : (
              <Film className="w-6 h-6" aria-hidden="true" />
            )}
            <span className="text-2xl font-black tracking-tight">
              {isDownloading && exportLabel === "Video"
                ? (exportProgress?.message ?? t("recording"))
                : t("downloadVideo")}
            </span>
          </div>
        </motion.button>

        {/* Export progress bar */}
        {exportProgress && (
          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="flex justify-between text-xs text-white/60 mb-2">
              <span>{exportProgress.message}</span>
              <span>{exportProgress.progress}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-theme-primary)] transition-all duration-300"
                style={{ width: `${exportProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Download PNG */}
        <motion.button
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
          whileHover={{ scale: 1.05, x: 10, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          className="w-full group relative"
          onClick={onDownloadImage}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isDownloading) {
              e.preventDefault();
              onDownloadImage();
            }
          }}
          disabled={isDownloading}
          aria-label={
            isDownloading ? "Generating share image" : "Download share image"
          }
        >
          <motion.div
            className="absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: "var(--color-theme-primary)" }}
          />
          <div
            className="relative flex items-center gap-4 backdrop-blur-sm px-8 py-6 rounded-2xl border"
            style={{
              backgroundColor:
                mode === "dark"
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.05)",
              color: mode === "dark" ? "#ffffff" : "#1a1a1a",
              borderColor:
                mode === "dark"
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(0,0,0,0.1)",
            }}
          >
            {isDownloading && exportLabel === null ? (
              <Loader2
                className="w-6 h-6 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Download className="w-6 h-6" aria-hidden="true" />
            )}
            <span className="text-2xl font-black tracking-tight">
              {isDownloading && exportLabel === null
                ? t("generatingCard")
                : t("downloadImage")}
            </span>
          </div>
        </motion.button>

        {/* Download error */}
        {downloadError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-sm text-red-200/90">{downloadError}</p>
            </div>
            <button
              type="button"
              onClick={onDownloadImage}
              disabled={isDownloading}
              className="text-sm font-bold text-red-200 hover:text-white transition-colors"
            >
              Retry download
            </button>
          </motion.div>
        )}

        {/* Main-thread fallback notice */}
        {usedMainThreadFallback && !downloadError && (
          <p className="text-sm text-white/50">
            Using main-thread encoding because worker support is unavailable.
          </p>
        )}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="mt-8 text-lg font-bold"
        style={{
          color:
            mode === "dark" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
        }}
      >
        {t("showJourney")}
      </motion.p>
    </motion.div>
  );
}
