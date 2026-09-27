"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Share2, Link2, Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useNativeShare } from "@/app/hooks/useNativeShare";
import { mockData } from "@/app/data/mockData";
import { GOLDEN_USER } from "@/src/data/mockData";
import { ProgressIndicator } from "@/app/components/ProgressIndicator";
import { MuteToggle } from "../../components/MuteToggle";
import { ShareCard } from "../../components/ShareCard";
import { ShareImageCard } from "../../components/ShareImageCard";
import { ShareImageCardStories } from "../../components/ShareImageCardStories";
import { useTheme, themeColors } from "../../context/ThemeContext";
import { useWrapStore } from "../../store/wrapStore";
import {
  XIcon,
  WhatsAppIcon,
  FacebookIcon,
  LinkedInIcon,
  TelegramIcon,
} from "../../components/SocialIcons";
import { trackEvent } from "../../utils/plausible";
import {
  buildSharePreviewSearchParams,
  hasSharePreviewParams,
  parseSharePreviewParams,
  type SharePreviewState,
} from "@/app/utils/sharePreviewParams";
import { getStellarExpertAccountUrl } from "@/app/utils/stellarExpert";
import { isZeroActivityResult } from "@/app/utils/zeroActivity";
import { ZeroActivityEmptyState } from "@/app/components/ZeroActivityEmptyState";
import {
  useReducedMotion,
  reducedMotionTransition,
} from "@/app/hooks/useReducedMotion";
import { useNativeShare } from "@/app/hooks/useNativeShare";

const SocialIcons = {
  X: XIcon,
  WhatsApp: WhatsAppIcon,
  Facebook: FacebookIcon,
  LinkedIn: LinkedInIcon,
  Telegram: TelegramIcon,
};

export default function SharePageClient() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("SharePage");
  const cardT = useTranslations("ShareCard");
  const cardLabels = {
    stellarWrapped: cardT("stellarWrapped"),
    totalTransactions: cardT("totalTransactions"),
    persona: cardT("persona"),
    topVibe: cardT("topVibe"),
    scanToView: cardT("scanToView"),
    scanToViewAlt: cardT("scanToViewAlt"),
    noVibeData: cardT("noVibeData"),
  };
  const [shareOpen, setShareOpen] = useState<boolean>(false);
  const [cardFormat, setCardFormat] = useState<"square" | "stories">("square");
  const shareMenuRef = useRef<HTMLDivElement | null>(null);
  const shareBtnRef = useRef<HTMLButtonElement | null>(null);
  const shareImageRef = useRef<HTMLDivElement>(null!);
  const { color } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const { address: walletAddress, network, result } = useWrapStore();
  const { isSupported: canNativeShare, share: nativeShare } = useNativeShare();

  const urlPreview = useMemo(
    () => parseSharePreviewParams(searchParams),
    [searchParams],
  );
  const isPublicPreview = hasSharePreviewParams(searchParams);

  const storePreview = useMemo<SharePreviewState>(
    () => ({
      username: result?.username ?? mockData.username,
      transactions: result?.totalTransactions ?? mockData.transactions,
      persona: result?.persona ?? mockData.persona,
      topVibe: result?.vibes[0]?.label ?? mockData.vibes[0].label,
      vibePercentage: result?.vibes[0]?.percentage ?? mockData.vibes[0].percentage,
    }),
    [result],
  );

  const displayPreview = isPublicPreview ? urlPreview : storePreview;

  const username = displayPreview.username;
  const transactions = displayPreview.transactions;
  const persona = displayPreview.persona;
  const topVibe = displayPreview.topVibe;
  const vibePercentage = displayPreview.vibePercentage;

  const stellarExpertUrl = !isPublicPreview && walletAddress ? getStellarExpertAccountUrl(walletAddress, network) : null;
  const showZeroActivity = isZeroActivityResult(result);

  const [themeColor] = useState<string>(() => {
    if (typeof window === "undefined") return themeColors.green.primary;

    const tempDiv = document.createElement("div");
    tempDiv.style.color = "var(--color-theme-primary)";
    document.body.appendChild(tempDiv);

    const computedColor = window.getComputedStyle(tempDiv).color;
    document.body.removeChild(tempDiv);

    return computedColor || themeColors[color].primary;
  });

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const query = buildSharePreviewSearchParams(storePreview).toString();
    const path = `${window.location.pathname}?${query}`;
    return `${window.location.origin}${path}`;
  }, [storePreview]);

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopyLink = async () => {
    const url = shareUrl || window.location.href;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareTitle = t("title");
  const shareText = t("shareText", {
    transactions,
    persona,
    vibePercentage,
    topVibe,
  });

  /**
   * Primary share button. Prefers the native share sheet when the browser
   * supports it (mobile), and falls back to the social menu otherwise.
   */
  const handlePrimaryShare = async () => {
    if (!canNativeShare) {
      setShareOpen((open) => !open);
      return;
    }

    trackEvent("share_clicked", { platform: "native" });

    const outcome = await nativeShare({
      title: shareTitle,
      text: shareText,
      url: window.location.href,
    });

    if (outcome === "shared") {
      trackEvent("share_completed", { platform: "native" });
      return;
    }

    if (outcome === "cancelled") {
      // User dismissed the share sheet — expected, so no error surfaces.
      trackEvent("share_cancelled", { platform: "native" });
      return;
    }

    // Unsupported payload or a genuine failure: fall back to the social menu.
    setShareOpen(true);
  };

  const handleShare = (platform: string) => {
    trackEvent("share_clicked", { platform });
    const url = shareUrl || window.location.href;
    const text = shareText;
    let platformShareUrl = "";

    switch (platform) {
      case "x":
        platformShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case "whatsapp":
        platformShareUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
        break;
      case "facebook":
        platformShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case "linkedin":
        platformShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case "telegram":
        platformShareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        break;
    }

    if (platformShareUrl) {
      window.open(platformShareUrl, "_blank", "width=600,height=500");
    }
    setShareOpen(false);
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        shareOpen &&
        !shareMenuRef.current?.contains(target) &&
        !shareBtnRef.current?.contains(target)
      ) {
        setShareOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && shareOpen) {
        setShareOpen(false);
        shareBtnRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [shareOpen]);

  useEffect(() => {
    if (shareOpen) {
      // Small delay to ensure the motion element is mounted before focusing
      const timer = setTimeout(() => {
        const firstButton = shareMenuRef.current?.querySelector("button");
        firstButton?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [shareOpen]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {showZeroActivity ? (
        <div className="relative z-20 flex h-full items-center justify-center">
          <ProgressIndicator currentStep={6} totalSteps={6} showNext={false} />
          <ZeroActivityEmptyState />
          {stellarExpertUrl && (
            <a
              href={stellarExpertUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-30 flex items-center gap-2 px-4 py-3 rounded-xl backdrop-blur-xl border border-white/10 text-white/60 hover:text-white/90 hover:border-white/30 transition-all text-xs font-medium"
              style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              {t("viewHistory")}
            </a>
          )}
        </div>
      ) : (
        <>
      <div
        ref={shareImageRef}
        className="absolute"
        style={{ left: "-9999px", top: 0 }}
      >
        {cardFormat === "stories" ? (
          <ShareImageCardStories themeColor={themeColor} archetypeImage={GOLDEN_USER.archetype.image} shareUrl={shareUrl} locale={locale} labels={cardLabels} />
        ) : (
          <ShareImageCard themeColor={themeColor} archetypeImage={GOLDEN_USER.archetype.image} shareUrl={shareUrl} locale={locale} labels={cardLabels} />
        )}
      </div>

      <ShareCard
        username={username}
        transactions={transactions}
        persona={persona}
        topVibe={topVibe}
        vibePercentage={vibePercentage}
        shareImageRef={shareImageRef}
        themeColor={themeColor}
        cardFormat={cardFormat}
        onFormatChange={setCardFormat}
      />

      <ProgressIndicator currentStep={6} totalSteps={6} showNext={false} />

      <motion.div
        className="absolute top-6 right-6 md:top-8 md:right-8 z-30"
        initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reducedMotionTransition(prefersReducedMotion, { delay: 0.2 })}
      >
        <MuteToggle />
      </motion.div>

      {stellarExpertUrl && (
        <motion.a
          href={stellarExpertUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-30 flex items-center gap-2 px-4 py-3 rounded-xl backdrop-blur-xl border border-white/10 text-white/60 hover:text-white/90 hover:border-white/30 transition-all text-xs font-medium"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reducedMotionTransition(prefersReducedMotion, { delay: 0.4 })}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View full history on Stellar.expert
        </motion.a>
      )}

      <div className="absolute bottom-6 left-6 z-30">
        <div className="relative">
          <AnimatePresence>
            {shareOpen && (
              <motion.div
                ref={shareMenuRef}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: 10, scale: 0.95 }}
                transition={reducedMotionTransition(prefersReducedMotion, { duration: 0.2 })}
                className="absolute bottom-18 left-0 w-[200px] h-[350px] bg-[#060607] border border-[#232325] rounded-2xl shadow-2xl p-2 z-50 flex flex-col items-center justify-center gap-2"
                style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }}
                role="menu"
                aria-label="Share this wrap"
              >
                <button
                  onClick={() => handleShare("x")}
                  role="menuitem"
                  className="flex cursor-pointer items-center pl-4 w-42 h-15 gap-3 p-2 rounded-xl bg-[#0F0F10] hover:bg-[#1a1a1c] transition-colors group"
                >
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-black border border-white/10">
                    <SocialIcons.X />
                  </div>
                  <span className="font-bold text-white tracking-wide">x</span>
                </button>

                <button
                  onClick={() => handleShare("whatsapp")}
                  role="menuitem"
                  className="flex cursor-pointer items-center pl-4 w-42 h-15 gap-3 p-2 rounded-xl bg-[#0F0F10] hover:bg-[#1a1a1c] transition-colors group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]">
                    <SocialIcons.WhatsApp />
                  </div>
                  <span className="font-bold text-white tracking-wide">
                    WhatsApp
                  </span>
                </button>

                <button
                  onClick={() => handleShare("facebook")}
                  role="menuitem"
                  className="flex items-center cursor-pointer pl-4 gap-3 p-2 w-42 h-15 rounded-xl bg-[#0F0F10] hover:bg-[#1a1a1c] transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2]">
                    <SocialIcons.Facebook />
                  </div>
                  <span className="font-bold text-white tracking-wide">
                    Facebook
                  </span>
                </button>

                <button
                  onClick={() => handleShare("linkedin")}
                  role="menuitem"
                  className="flex items-center pl-4 cursor-pointer gap-3 p-2 w-42 h-15 rounded-xl bg-[#0F0F10] hover:bg-[#1a1a1c] transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0077B5]">
                    <SocialIcons.LinkedIn />
                  </div>
                  <span className="font-bold text-white tracking-wide">
                    LinkedIn
                  </span>
                </button>

                <button
                  onClick={() => handleShare("telegram")}
                  role="menuitem"
                  className="flex items-center cursor-pointer pl-4 gap-3 p-2 w-42 h-15 rounded-xl bg-[#0F0F10] hover:bg-[#1a1a1c] transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#229ED9]">
                    <SocialIcons.Telegram />
                  </div>
                  <span className="font-bold text-white tracking-wide">
                    Telegram
                  </span>
                </button>

                <button
                  onClick={handleCopyLink}
                  role="menuitem"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCopyLink();
                    }
                  }}
                  className="flex items-center cursor-pointer pl-4 gap-3 p-2 w-42 h-15 rounded-xl bg-[#0F0F10] hover:bg-[#1a1a1c] transition-colors"
                  aria-live="polite"
                  aria-label={copied ? t("linkCopied") : t("copyLink")}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366f1]">
                    {copied ? (
                      <Check className="h-5 w-5 text-white" />
                    ) : (
                      <Link2 className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <span className="font-bold text-white tracking-wide">
                    {copied ? t("copied") : t("copyLink")}
                  </span>
                </button>

                {copyError && (
                  <p className="text-xs text-red-400" aria-live="assertive">
                    {copyError}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            ref={shareBtnRef}
            type="button"
            onClick={() => setShareOpen(!shareOpen)}
            className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md transition hover:bg-white/5"
            aria-label={shareOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={shareOpen}
            aria-haspopup="menu"
          >
            <motion.div
              animate={{ rotate: shareOpen ? 50 : 0 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 20 }
              }
            >
              <Share2 className="h-5 w-5 sm:h-7 sm:w-7 cursor-pointer" aria-hidden="true" />
            </motion.div>
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
