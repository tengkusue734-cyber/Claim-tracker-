const CACHE = "claim-tracker-v4";
const ASSETS = ["./", "./index.html", "./claim.html", "./print.html", "./styles.css", "./claim.js", "./cloud.js", "./app-config.js", "./default-logo.js", "./logo.png", "./firebase-config.js", "./app.js", "./detail.js", "./print.js", "./manifest.json", "./icon.svg", "./favicon.ico", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
});
