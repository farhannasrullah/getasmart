const CACHE_NAME = "getasmart-v3";

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

const IMAGE_HOSTS = [
  "images.unsplash.com",
  "res.cloudinary.com"
];

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
  if (event.request.method !== "GET") return;

  const request = event.request;
  const url = new URL(request.url);

  const isImage =
    request.destination === "image" &&
    IMAGE_HOSTS.includes(url.hostname);

  /*
   * IMAGE CACHE
   * Cache gambar eksternal setelah pertama kali berhasil dimuat.
   */
  if (isImage) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then(response => {
            if (response && response.status === 200) {
              const responseClone = response.clone();

              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
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
   * APP SHELL / SAME ORIGIN
   */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        return cachedResponse || fetch(request);
      })
    );
  }
});