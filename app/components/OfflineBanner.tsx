"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/app/hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-[72px] z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-yellow-300/30 bg-yellow-400 px-4 py-2 text-sm font-bold text-black shadow-2xl shadow-black/30"
    >
      <WifiOff className="h-4 w-4" />
      You&apos;re offline — viewing cached data
    </div>
  );
}
