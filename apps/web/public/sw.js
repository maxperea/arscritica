const CACHE = "covers-v1";
const MAX_ENTRIES = 200;
const COVER_PATH = /^\/release(-group)?\/[0-9a-f-]+\/(front|\d+)(-\d+)?(\.jpg)?$/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("covers-") && name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.hostname !== "coverartarchive.org" || !COVER_PATH.test(url.pathname)) return;
  event.respondWith(cachedCover(request.url, event));
});

async function cachedCover(url, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(url);
  if (cached) {
    event.waitUntil(cache.put(url, cached.clone()));
    return cached;
  }
  const response = await fetch(url, { mode: "cors", credentials: "omit" }).catch(() => undefined);
  if (!response) return fetch(url, { mode: "no-cors", credentials: "omit" });
  if (response.ok && response.type === "cors") {
    event.waitUntil(cache.put(url, response.clone()).then(() => trim(cache)));
  }
  return response;
}

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((key) => cache.delete(key)),
  );
}
