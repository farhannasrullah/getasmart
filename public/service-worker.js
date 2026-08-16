const CACHE_NAME = "getasmart-v5";

const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/firebase-config.js",
  "/firebase-init.js",
  "/manifest.json",
  "/icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png"
];

const IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "res.cloudinary.com"
]);

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
   * ==========================================================
   * 1. SAME ORIGIN
   * ==========================================================
   */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request, {
        ignoreSearch: true
      }).then(cachedResponse => {

        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then(response => {

            if (
              response &&
              response.status === 200 &&
              response.type === "basic"
            ) {
              const clone = response.clone();

              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, clone);
              });
            }

            return response;
          })
          .catch(() => {

            /*
             * Kalau navigasi halaman saat offline,
             * kembalikan index.html.
             */
            if (request.mode === "navigate") {
              return caches.match("/index.html");
            }

            /*
             * Untuk asset lokal yang belum tercache,
             * jangan bikin unhandled promise rejection.
             */
            return new Response("", {
              status: 503,
              statusText: "Offline"
            });
          });
      })
    );

    return;
  }

  /*
   * ==========================================================
   * 2. EXTERNAL IMAGES
   * ==========================================================
   */

  const isExternalImage =
    request.destination === "image" &&
    IMAGE_HOSTS.has(url.hostname);

  if (isExternalImage) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {

        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then(response => {

            if (response && response.status === 200) {
              const clone = response.clone();

              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, clone);
              });
            }

            return response;
          })
          .catch(() => {
            return new Response("", {
              status: 503,
              statusText: "Offline"
            });
          });
      })
    );

    return;
  }

  /*
   * ==========================================================
   * 3. REQUEST EKSTERNAL LAIN
   * ==========================================================
   *
   * Firebase, Google Fonts, Tailwind CDN, dll:
   * biarkan browser menangani secara normal.
   */

  return;
});