"use client";

import { useEffect } from "react";
import { logger } from "@/app/utils/logger";

const log = logger.child("ServiceWorkerManager");

export function ServiceWorkerManager() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost"
    ) {
      return;
    }

    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
    let refreshing = false;
    let hasController = Boolean(navigator.serviceWorker.controller);
    let registeredServiceWorker: ServiceWorkerRegistration | null = null;

    const handleControllerChange = () => {
      if (!hasController) {
        hasController = true;
        return;
      }
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const refreshOnFocus = () => {
      if (registeredServiceWorker && document.visibilityState === "visible") {
        void registeredServiceWorker.update();
      }
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );
    document.addEventListener("visibilitychange", refreshOnFocus);

    void navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(appVersion)}`)
      .then((registration) => {
        registeredServiceWorker = registration;

        const activateWaitingWorker = () => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        };

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              activateWaitingWorker();
            }
          });
        });
      })
      .catch((error) => {
        log.warn("Service worker registration failed:", error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, []);

  return null;
}
