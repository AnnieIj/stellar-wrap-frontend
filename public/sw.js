const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_PREFIX = "stellar-wrap";
const STATIC_CACHE = `${CACHE_PREFIX}-static-${VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${VERSION}`;

const APP_SHELL = [
  "/",
  "/connect",
  "/loading",
  "/persona",
  "/share",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/stellar-wrap.png",
  "/stellar-wrap-2.png",
  "/archetypes/explorer.png",
  "/archetypes/wizard.png",
  "/audio/card-flip.mp3",
  "/audio/slide-whoosh.mp3",
  "/audio/mint-success.mp3",
  "/audio/bg-music.mp3"
];

const STATIC_EXTENSIONS = [
  ".css",
  ".js",
  ".mjs",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: "reload" }))
        )
      );
      await self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(`${CACHE_PREFIX}-`) &&
                ![STATIC_CACHE, RUNTIME_CACHE, API_CACHE].includes(key)
            )
            .map((key) => caches.delete(key))
        )
      ),
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable()
        : Promise.resolve()
    ]).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!["http:", "https:"].includes(url.protocol)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (["image", "font", "style", "script"].includes(request.destination)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  }
});

function isStaticAsset(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  return STATIC_EXTENSIONS.some((extension) =>
    url.pathname.toLowerCase().endsWith(extension)
  );
}

async function networkFirstNavigation(event) {
  const cached = await caches.match(event.request);

  try {
    const preloadResponse = await event.preloadResponse;
    if (preloadResponse) {
      await putInCache(STATIC_CACHE, event.request, preloadResponse.clone());
      return preloadResponse;
    }

    const response = await fetch(event.request);
    if (isCacheable(response)) {
      await putInCache(STATIC_CACHE, event.request, response.clone());
    }
    return response;
  } catch {
    return (
      cached ||
      (await caches.match(new URL(event.request.url).pathname)) ||
      (await caches.match("/persona")) ||
      (await caches.match("/")) ||
      Response.error()
    );
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheable(response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function putInCache(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

function isCacheable(response) {
  return response && (response.ok || response.type === "opaque");
}
