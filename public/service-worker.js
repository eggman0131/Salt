// -----------------------------
// SALT PWA — Modern Service Worker
// -----------------------------

// ⚠️ IMPORTANT: bump this on every deploy
const BUILD_VERSION = "2026-03-10-02";

const CACHE_STATIC = `salt-static-${BUILD_VERSION}`;
const CACHE_RUNTIME = `salt-runtime-${BUILD_VERSION}`;

// Only cache immutable assets here
const PRECACHE_URLS = [
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

// -----------------------------
// INSTALL — Precache static assets
// -----------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// -----------------------------
// ACTIVATE — Clean old caches + take control
// -----------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![CACHE_STATIC, CACHE_RUNTIME].includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// -----------------------------
// FETCH — Smart caching strategy
// -----------------------------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. HTML → network-first (critical for updates)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache the fresh HTML
          const clone = res.clone();
          caches.open(CACHE_RUNTIME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req)) // fallback to cached HTML
    );
    return;
  }

  // 2. Firebase / API → network-first (only cache GET responses — Cache API rejects POST/HEAD)
  if (
    url.hostname.includes("googleapis.com") ||
    url.pathname.startsWith("/api/")
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.status === 200 && req.method === "GET") {
            const clone = res.clone();
            caches.open(CACHE_RUNTIME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => req.method === "GET" ? caches.match(req) : Promise.reject())
    );
    return;
  }

  // 3. Static assets → stale-while-revalidate
  if (req.destination === "script" ||
      req.destination === "style" ||
      req.destination === "image" ||
      req.destination === "font") {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_RUNTIME).then((cache) => cache.put(req, clone));
            }
            return res;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: just fetch
  event.respondWith(fetch(req));
});

// -----------------------------
// OPTIONAL: Background Sync
// -----------------------------
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-recipes") {
    event.waitUntil(syncRecipes());
  }
});

async function syncRecipes() {
  console.log("Background sync triggered");
}

// -----------------------------
// Push Notifications
// -----------------------------
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "SALT Notification";

  const options = {
    body: data.body || "You have a new notification",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [200, 100, 200],
    data: data.url || "/"
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});