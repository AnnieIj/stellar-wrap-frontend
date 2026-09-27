"use client";

import { useCallback, useEffect, useState } from "react";

export type NativeShareResult = "shared" | "cancelled" | "unsupported" | "failed";

export interface NativeShareData {
  title?: string;
  text?: string;
  url?: string;
}

type ShareCapableNavigator = Navigator & {
  share?: (data: NativeShareData) => Promise<void>;
  canShare?: (data: NativeShareData) => boolean;
};

function getNavigator(): ShareCapableNavigator | undefined {
  return typeof navigator === "undefined"
    ? undefined
    : (navigator as ShareCapableNavigator);
}

/**
 * True when the Web Share API is available (typically mobile browsers and
 * some desktop browsers). Always false during SSR.
 */
export function isNativeShareSupported(
  nav: ShareCapableNavigator | undefined = getNavigator(),
): boolean {
  return typeof nav?.share === "function";
}

/**
 * The user dismissing the native share sheet rejects with an AbortError.
 * That is a normal outcome, not a failure, and must never surface as an error.
 */
function isCancellation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = (error as { name?: string }).name;
  return name === "AbortError";
}

/**
 * Invokes the native share sheet. Never throws — the outcome is returned so
 * callers can distinguish a cancellation from a real failure.
 */
export async function nativeShare(
  data: NativeShareData,
  nav: ShareCapableNavigator | undefined = getNavigator(),
): Promise<NativeShareResult> {
  if (!isNativeShareSupported(nav) || !nav?.share) return "unsupported";

  // Some platforms expose share() but reject specific payloads.
  if (typeof nav.canShare === "function" && !nav.canShare(data)) {
    return "unsupported";
  }

  try {
    await nav.share(data);
    return "shared";
  } catch (error) {
    return isCancellation(error) ? "cancelled" : "failed";
  }
}

/**
 * Web Share API access for components.
 *
 * `isSupported` is resolved in an effect rather than during render so the
 * server and client markup match on first paint.
 */
export function useNativeShare() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(isNativeShareSupported());
  }, []);

  const share = useCallback(
    (data: NativeShareData): Promise<NativeShareResult> => nativeShare(data),
    [],
  );

  return { isSupported, share };
}
