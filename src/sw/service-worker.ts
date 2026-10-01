/**
 * Service worker for Stellar Wrapped push notifications.
 * Compiled to public/sw.js via: esbuild src/sw/service-worker.ts --bundle --outfile=public/sw.js --platform=browser
 */

interface PushPayload {
  title: string;
  body: string;
  icon: string;
  actionUrl: string;
}

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() as PushPayload;

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: "/icon-192.png",
      data: { url: data.actionUrl },
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const url: string =
    event.notification.data?.url ?? "/connect";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If a window with that URL is already open, focus it
        for (const client of windowClients) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});
