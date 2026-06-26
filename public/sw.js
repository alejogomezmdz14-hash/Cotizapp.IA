const CACHE_NAME = "cotizapp-shell-v9";
const SHELL_ASSETS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/** Rutas que nunca deben pasar por el SW (auth Clerk, APIs, navegación). */
const BYPASS_PATH_PREFIXES = [
  "/api/",
  "/api/auth",
  "/_next/data/",
  "/auth/",
  "/sign-in",
  "/sign-up",
  "/login",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

function shouldBypassFetch(url) {
  if (url.hostname.includes("clerk.accounts.dev") || url.hostname.includes("clerk.com")) {
    return true;
  }

  return BYPASS_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (shouldBypassFetch(url)) {
    return;
  }

  // No interceptamos las navegaciones de página: las maneja el navegador de
  // forma nativa. Interceptarlas con event.respondWith(fetch(...)) puede romper
  // el handshake de autenticación de Clerk en móvil (las cookies/redirect del
  // login no se aplican bien) → la sesión no persiste. Dejarlas pasar es lo
  // recomendado cuando no se cachea navegación offline.
  if (request.mode === "navigate") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (
            response.ok &&
            (request.destination === "image" ||
              request.destination === "style" ||
              request.destination === "font" ||
              request.destination === "script" ||
              url.pathname === "/manifest.json")
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached ?? network;
    }),
  );
});
