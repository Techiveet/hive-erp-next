// public/sw.js
const VERSION = "v1";
const STATIC_CACHE = `hive-static-${VERSION}`;
const RUNTIME_CACHE = `hive-runtime-${VERSION}`;
const SYNC_TAG = "sync-pending";

const PRECACHE_URLS = ["/", "/offline.html", "/manifest.json", "/icon"];

let lastNetState = "unknown";

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}

function setNetState(next) {
  if (lastNetState === next) return;
  lastNetState = next;
  broadcast({ type: next === "offline" ? "net-offline" : "net-online" });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isHTMLRequest(req) {
  return req.headers.get("accept")?.includes("text/html");
}

function isCacheableAsset(url) {
  // Static assets (Next build assets, images, fonts, css, js)
  if (url.pathname.startsWith("/_next/")) return true;
  if (url.pathname.startsWith("/fonts/")) return true;
  if (url.pathname.startsWith("/images/")) return true;
  return /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2|woff|ttf)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET
  if (req.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Never cache API routes
  if (url.pathname.startsWith("/api/")) return;

  // Ignore Next dev/HMR endpoints
  if (url.pathname.includes("hot-update") || url.pathname.includes("__nextjs")) return;

  // HTML = network-first
  if (isHTMLRequest(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          setNetState("online");
          return fresh;
        } catch {
          setNetState("offline");
          const cached = await caches.match(req);
          return cached || (await caches.match("/offline.html")) || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Assets = stale-while-revalidate
  if (isCacheableAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);

        const fetchPromise = fetch(req)
          .then((res) => {
            setNetState("online");
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => {
            setNetState("offline");
            return cached || new Response("", { status: 503, statusText: "Offline" });
          });

        return cached || fetchPromise;
      })()
    );
    return;
  }

  // Default = try network, fallback cache
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      try {
        const res = await fetch(req);
        setNetState("online");
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        setNetState("offline");
        return cached || new Response("", { status: 503, statusText: "Offline" });
      }
    })()
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag !== SYNC_TAG) return;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: "trigger-sync" });
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  const { type } = event.data || {};

  if (type === "sync-pending") {
    event.waitUntil(
      (async () => {
        try {
          if ("sync" in self.registration) {
            await self.registration.sync.register(SYNC_TAG);
          } else {
            await broadcast({ type: "trigger-sync" });
          }
        } catch {
          await broadcast({ type: "trigger-sync" });
        }
      })()
    );
    return;
  }

  if (type === "check-connection") {
    event.waitUntil(
      (async () => {
        try {
          await fetch("/api/health", { method: "HEAD", cache: "no-store" });
          setNetState("online");
        } catch {
          setNetState("offline");
        }
      })()
    );
  }
});
