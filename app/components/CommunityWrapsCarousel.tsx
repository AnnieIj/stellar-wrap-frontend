"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  FEATURED_WRAPS,
  type FeaturedWrap,
} from "@/src/data/featuredWraps";

const AUTO_SCROLL_MS = 4000;

export function CommunityWrapsCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [lightboxWrap, setLightboxWrap] = useState<FeaturedWrap | null>(null);
  const [visibleCount, setVisibleCount] = useState(4);

  useEffect(() => {
    const updateVisible = () => {
      const w = window.innerWidth;
      if (w < 640) setVisibleCount(1);
      else if (w < 1024) setVisibleCount(3);
      else setVisibleCount(4);
    };
    updateVisible();
    window.addEventListener("resize", updateVisible);
    return () => window.removeEventListener("resize", updateVisible);
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.children[index] as HTMLElement | undefined;
    if (card) {
      el.scrollTo({ left: card.offsetLeft - 16, behavior: "smooth" });
    }
    setActiveIndex(index);
  }, []);

  const scrollBy = useCallback(
    (direction: "prev" | "next") => {
      const next =
        direction === "next"
          ? (activeIndex + 1) % FEATURED_WRAPS.length
          : (activeIndex - 1 + FEATURED_WRAPS.length) % FEATURED_WRAPS.length;
      scrollToIndex(next);
    },
    [activeIndex, scrollToIndex],
  );

  useEffect(() => {
    if (isPaused || lightboxWrap) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % FEATURED_WRAPS.length;
        scrollToIndex(next);
        return next;
      });
    }, AUTO_SCROLL_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, lightboxWrap, scrollToIndex]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    let closest = 0;
    let minDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const dist = Math.abs((child as HTMLElement).offsetLeft - scrollLeft);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  };

  const cardWidthClass =
    visibleCount === 1
      ? "w-[85vw] sm:w-[320px]"
      : visibleCount === 3
        ? "w-[calc(33.333%-0.75rem)] min-w-[240px]"
        : "w-[calc(25%-0.75rem)] min-w-[220px]";

  return (
    <section className="relative w-full py-12 md:py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight mb-2">
            Community Wraps
          </h2>
          <p className="text-sm md:text-base text-white/50 max-w-xl mx-auto">
            See what others have discovered about their Stellar journey
          </p>
        </motion.div>

        <div
          className="relative group"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <button
            type="button"
            onClick={() => scrollBy("prev")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/90 transition-all opacity-0 group-hover:opacity-100"
            aria-label="Previous wrap"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => scrollBy("next")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/90 transition-all opacity-0 group-hover:opacity-100"
            aria-label="Next wrap"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 scrollbar-hide touch-pan-x"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {FEATURED_WRAPS.map((wrap, i) => (
              <motion.button
                key={wrap.id}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                onClick={() => setLightboxWrap(wrap)}
                className={`${cardWidthClass} shrink-0 snap-start rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden text-left hover:border-white/30 transition-all cursor-pointer group/card`}
              >
                <div className="relative aspect-square w-full overflow-hidden">
                  <Image
                    src={wrap.archetypeImage}
                    alt={wrap.persona}
                    fill
                    loading="lazy"
                    className="object-cover group-hover/card:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 85vw, (max-width: 1024px) 33vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-lg font-black text-white">{wrap.persona}</p>
                    <p className="text-xs text-white/60">
                      {wrap.transactionCount.toLocaleString()} transactions
                    </p>
                  </div>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-white/40">@{wrap.username}</span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(var(--color-theme-primary-rgb), 0.15)",
                      color: "var(--color-theme-primary)",
                    }}
                  >
                    {wrap.topVibe}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>

          <div className="flex justify-center gap-2 mt-4">
            {FEATURED_WRAPS.map((wrap, i) => (
              <button
                key={wrap.id}
                type="button"
                onClick={() => scrollToIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === activeIndex
                    ? "w-6 bg-[var(--color-theme-primary)]"
                    : "bg-white/30 hover:bg-white/50"
                }`}
                aria-label={`Go to ${wrap.persona}`}
              />
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {lightboxWrap && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setLightboxWrap(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightboxWrap(null)}
                className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/20">
                <Image
                  src={lightboxWrap.shareCardImage}
                  alt={`${lightboxWrap.persona} share card`}
                  fill
                  className="object-cover"
                  sizes="512px"
                  priority
                />
              </div>
              <div className="mt-4 text-center">
                <p className="text-2xl font-black text-white">{lightboxWrap.persona}</p>
                <p className="text-white/60 mt-1">
                  {lightboxWrap.transactionCount.toLocaleString()} transactions · {lightboxWrap.topVibe}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
