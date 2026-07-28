const CACHE = "dnevnik-nastyushki-v6-push";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() || "" };
  }

  const title = data.title || "Дневник Настюшки";
  const options = {
    body: data.body || "У тебя запланировано дело",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: data.tag || "dnevnik-reminder",
    renotify: true,
    data: { url: data.url || "./" }
  };

  const jobs = [self.registration.showNotification(title, options)];
  if (self.navigator && "setAppBadge" in self.navigator) {
    jobs.push(self.navigator.setAppBadge(1).catch(() => {}));
  }
  event.waitUntil(Promise.all(jobs));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "./", self.registration.scope).href;

  event.waitUntil((async () => {
    if (self.navigator && "clearAppBadge" in self.navigator) {
      await self.navigator.clearAppBadge().catch(() => {});
    }

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        if ("navigate" in client) await client.navigate(targetUrl);
        await client.focus();
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
