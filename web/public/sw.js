const CACHE_NAME = "crm-doctor-v2-v2"
const PRECACHE_URLS = ["/", "/login", "/manifest.json", "/icons/icon.svg", "/icons/maskable-icon.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  const url = new URL(req.url)

  if (req.method !== "GET") return
  if (url.pathname.startsWith("/api/")) return

  const accept = req.headers.get("accept") || ""
  const isNavigation = req.mode === "navigate" || accept.includes("text/html")

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
    )
    return
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {})
          return res
        })
        .catch(() => cached)
    })
  )
})

self.addEventListener("push", function (event) {
  if (!event.data) return
  let payload = null
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "CRM Doctor", body: String(event.data.text ? event.data.text() : ""), url: "/" }
  }
  const options = {
    body: payload.body,
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      url: payload.url
    }
  }
  event.waitUntil(self.registration.showNotification(payload.title || "CRM Doctor", options))
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => client.postMessage({ type: "PLAY_SOUND" }))
  })
})

self.addEventListener("notificationclick", function (event) {
  event.notification.close()
  const url = (event.notification && event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(clients.openWindow(url))
})
