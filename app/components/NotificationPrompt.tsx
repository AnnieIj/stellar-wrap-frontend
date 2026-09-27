"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Mail, X } from "lucide-react";
import Link from "next/link";
import { useWrapStore } from "@/app/store/wrapStore";
import { useNotificationStore } from "@/app/store/notificationStore";
import { useServiceWorker } from "@/app/hooks/useServiceWorker";

interface NotificationPromptProps {
  /** Called when the prompt is dismissed or completed so the parent can hide it */
  onDismiss?: () => void;
}

export function NotificationPrompt({ onDismiss }: NotificationPromptProps) {
  const { address } = useWrapStore();
  const store = useNotificationStore();
  const sw = useServiceWorker();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't render if already opted in, permission denied (handled separately), or no address
  if (!address || store.consentGiven || store.pushEnabled) return null;

  async function handleEnablePush() {
    if (!sw.isSupported) return;
    setLoading(true);
    setError(null);

    try {
      await sw.subscribe();

      if (sw.permissionState === "denied") {
        store.setPermissionDenied(true);
        setLoading(false);
        return;
      }

      if (!sw.pushSubscription) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          subscription: sw.pushSubscription.toJSON(),
          periods: { weekly: false, monthly: true, yearly: true },
        }),
      });

      if (!res.ok) throw new Error("Could not save subscription");

      store.setPushEnabled(true);
      store.setConsentGiven(true);
      onDismiss?.();
    } catch {
      setError("Something went wrong. Try again or use email instead.");
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    // Session-only dismiss — don't permanently set permissionDenied
    sessionStorage.setItem("notif-prompt-dismissed", "true");
    onDismiss?.();
  }

  const showEmailAlternative = store.permissionDenied || !sw.isSupported;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="relative rounded-2xl border border-white/10 bg-[#12122a]/90 backdrop-blur-md p-5 max-w-md w-full shadow-xl"
        role="region"
        aria-label="Notification opt-in prompt"
      >
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss notification prompt"
          className="absolute top-3 right-3 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-theme-primary)]/20 flex items-center justify-center flex-shrink-0">
            <Bell size={18} className="text-[var(--color-theme-primary)]" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug">
              Get notified when your next wrap is ready
            </p>
            <p className="text-xs text-white/50 mt-1">
              We&apos;ll send you a notification at the start of each period — no spam.
            </p>

            {error && (
              <p className="text-red-400 text-xs mt-2">{error}</p>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {!showEmailAlternative ? (
                <button
                  onClick={handleEnablePush}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-theme-primary)] text-black text-xs font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity"
                >
                  {loading ? (
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Bell size={12} />
                  )}
                  Enable notifications
                </button>
              ) : (
                <Link
                  href="/notifications"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-theme-primary)] text-black text-xs font-semibold hover:opacity-90 transition-opacity"
                  onClick={onDismiss}
                >
                  <Mail size={12} />
                  Subscribe via email
                </Link>
              )}

              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 border border-white/10 hover:bg-white/5 transition-colors"
              >
                Not now
              </button>
            </div>

            {!showEmailAlternative && (
              <Link
                href="/notifications"
                className="text-xs text-white/40 hover:text-white/60 underline mt-2 inline-block transition-colors"
                onClick={onDismiss}
              >
                Use email instead
              </Link>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
