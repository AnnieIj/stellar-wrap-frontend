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

  const socialPlatforms = [
    { id: "x", label: t("platforms.x"), Icon: SocialIcons.X },
    { id: "whatsapp", label: t("platforms.whatsapp"), Icon: SocialIcons.WhatsApp },
    { id: "facebook", label: t("platforms.facebook"), Icon: SocialIcons.Facebook },
    { id: "linkedin", label: t("platforms.linkedin"), Icon: SocialIcons.LinkedIn },
    { id: "telegram", label: t("platforms.telegram"), Icon: SocialIcons.Telegram },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("heading")}</h1>
          <MuteToggle />
        </div>

        {showZeroActivity ? (
          <ZeroActivityEmptyState />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <button
                ref={shareBtnRef}
                type="button"
                onClick={handlePrimaryShare}
                aria-haspopup="menu"
                aria-expanded={shareOpen}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-black transition hover:bg-white/90"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                {t("shareButton")}
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 font-semibold text-white transition hover:bg-white/10"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? t("copied") : t("copyLink")}
              </button>

              {stellarExpertUrl && (
                <a
                  href={stellarExpertUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 font-semibold text-white transition hover:bg-white/10"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {t("viewOnStellarExpert")}
                </a>
              )}
            </div>

            {copyError && (
              <p role="alert" className="mb-4 text-sm text-red-400">
                {copyError}
              </p>
            )}

            <AnimatePresence>
              {shareOpen && (
                <motion.div
                  ref={shareMenuRef}
                  role="menu"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={reducedMotionTransition(prefersReducedMotion)}
                  className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  {socialPlatforms.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleShare(id)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mb-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCardFormat("square")}
                aria-pressed={cardFormat === "square"}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  cardFormat === "square"
                    ? "bg-white text-black"
                    : "border border-white/20 text-white hover:bg-white/10"
                }`}
              >
                {t("formats.square")}
              </button>
              <button
                type="button"
                onClick={() => setCardFormat("stories")}
                aria-pressed={cardFormat === "stories"}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  cardFormat === "stories"
                    ? "bg-white text-black"
                    : "border border-white/20 text-white hover:bg-white/10"
                }`}
              >
                {t("formats.stories")}
              </button>
            </div>

            <div ref={shareImageRef} className="mb-8">
              {cardFormat === "square" ? (
                <ShareImageCard
                  username={username}
                  transactions={transactions}
                  persona={persona}
                  topVibe={topVibe}
                  vibePercentage={vibePercentage}
                  themeColor={themeColor}
                  labels={cardLabels}
                />
              ) : (
                <ShareImageCardStories
                  username={username}
                  transactions={transactions}
                  persona={persona}
                  topVibe={topVibe}
                  vibePercentage={vibePercentage}
                  themeColor={themeColor}
                  labels={cardLabels}
                />
              )}
            </div>

            <ShareCard
              username={username}
              transactions={transactions}
              persona={persona}
              topVibe={topVibe}
              vibePercentage={vibePercentage}
              themeColor={themeColor}
              labels={cardLabels}
            />

            <div className="mt-8">
              <ProgressIndicator />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
