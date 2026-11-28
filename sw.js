const VERSION = "hk-static-v3";
const TILES = "hk-tiles-v1";
const STATIC = [
  "./",
  "index.html",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "pois.json",
  "places.json",
  "hotels.json",
  "extras.json",
  "shooting.json",
  "traffic-roads.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(STATIC.map((url) => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== VERSION && key !== TILES).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (/arcgisonline\.com|opentopomap\.org|tile\.openstreetmap\.org/.test(url.hostname)) {
    event.respondWith(
      caches.open(TILES).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req))
      )
    );
    return;
  }

  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return resp;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
  );
});
