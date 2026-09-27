"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const VISIT_COUNT_KEY = "stellar-wrap-visit-count";
const DISMISSED_KEY = "stellar-wrap-install-dismissed";

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean(
        (window.navigator as Navigator & { standalone?: boolean }).standalone,
      ))
  );
}

function isMobileInstallTarget(): boolean {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 768px)").matches
  );
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [canShow, setCanShow] = useState(false);

  useEffect(() => {
    const visits = Number(localStorage.getItem(VISIT_COUNT_KEY) || "0") + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(visits));

    const dismissed = localStorage.getItem(DISMISSED_KEY) === "true";
    setCanShow(
      visits >= 2 &&
        !dismissed &&
        !isStandaloneDisplay() &&
        isMobileInstallTarget(),
    );

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  if (!canShow || !installEvent) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setCanShow(false);
  };

  const install = async () => {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(DISMISSED_KEY, "true");
    }
    setInstallEvent(null);
    setCanShow(false);
  };

  return (
    <div className="fixed bottom-5 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/15 bg-black/90 p-3 text-white shadow-2xl shadow-black/40 backdrop-blur-xl sm:left-auto sm:right-5 sm:translate-x-0">
      <button
        type="button"
        onClick={install}
        className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-black"
      >
        <Download className="h-4 w-4" />
        Add to Home Screen
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="rounded-xl border border-white/10 p-3 text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
