"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "@/app/utils/logger";

const log = logger.child("useServiceWorker");

export interface UseServiceWorkerReturn {
  isSupported: boolean;
  permissionState: NotificationPermission | null;
  pushSubscription: PushSubscription | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

// `Uint8Array<ArrayBuffer>`, not the default `Uint8Array<ArrayBufferLike>`:
// `Uint8Array.from()` below always constructs a plain ArrayBuffer-backed
// array (never SharedArrayBuffer-backed), and PushManager.subscribe()'s
// applicationServerKey requires a BufferSource, which as of TypeScript
// 5.7's lib.dom types no longer accepts the wider ArrayBufferLike.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permissionState, setPermissionState] =
    useState<NotificationPermission | null>(null);
  const [pushSubscription, setPushSubscription] =
    useState<PushSubscription | null>(null);

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setIsSupported(supported);

    if (!supported) return;

    // Set current permission state
    setPermissionState(Notification.permission);

    // Register the service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registrationRef.current = registration;

        // Check for existing push subscription
        return registration.pushManager.getSubscription();
      })
      .then((existing) => {
        if (existing) {
          setPushSubscription(existing);
        }
      })
      .catch((err) => {
        log.warn("Registration failed:", err);
        setIsSupported(false);
      });
  }, []);

  const subscribe = useCallback(async (): Promise<void> => {
    if (!isSupported || !registrationRef.current) return;

    const permission = await Notification.requestPermission();
    setPermissionState(permission);

    if (permission !== "granted") return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      log.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
      return;
    }

    try {
      const subscription = await registrationRef.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      setPushSubscription(subscription);
    } catch (err) {
      log.warn("Push subscription failed:", err);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!pushSubscription) return;
    try {
      await pushSubscription.unsubscribe();
      setPushSubscription(null);
    } catch (err) {
      log.warn("Unsubscribe failed:", err);
    }
  }, [pushSubscription]);

  return { isSupported, permissionState, pushSubscription, subscribe, unsubscribe };
}
