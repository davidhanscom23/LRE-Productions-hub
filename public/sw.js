// Service worker: installability + web push notifications.
// Caches only the event gear checklist page and immutable build files (see below), so staff
// always get the latest version of everything else.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Offline gear checklist. Only two things are ever cached: the page for an event's gear
// checklist (so staff can reopen it with no signal) and the hashed, immutable /_next/static files
// it needs. Everything else passes straight to the network, exactly as before.
const CHECKLIST_CACHE = "checklist-pages-v1";
const STATIC_CACHE = "checklist-static-v1";
const CHECKLIST_PATH = /^\/event-checklist\/[0-9a-f-]{36}\/?$/i;

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("checklist-") && k !== CHECKLIST_CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
});

function isRscRequest(request, url) {
  return request.headers.get("RSC") || request.headers.get("Next-Router-State-Tree") || url.searchParams.has("_rsc");
}

// Page: network first (4s), fall back to the saved copy. Only real 200 pages are saved: a redirect
// means the person was sent to sign in, and that must never be stored as the checklist.
async function checklistPage(request, url) {
  const cache = await caches.open(CHECKLIST_CACHE);
  const key = url.origin + url.pathname.replace(/\/$/, "");
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(request, { signal: ctrl.signal });
    clearTimeout(timer);
    const type = res.headers.get("content-type") || "";
    if (res.status === 200 && !res.redirected && type.includes("text/html")) {
      await cache.put(key, res.clone());
    } else if (res.redirected || res.status === 401 || res.status === 403) {
      await cache.delete(key);
    }
    return res;
  } catch (e) {
    const saved = await cache.match(key);
    if (saved) return saved;
    throw e;
  }
}

async function staticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.status === 200) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && CHECKLIST_PATH.test(url.pathname) && !isRscRequest(request, url)) {
    event.respondWith(checklistPage(request, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticAsset(request));
  }
  // anything else: let the browser handle it normally
});

// Signing out on a shared device wipes the saved checklist pages.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "purge-checklists") {
    event.waitUntil(caches.delete(CHECKLIST_CACHE));
  }
});

// Show a notification when the hub sends a web push.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "LRE Hub";
  const options = {
    body: data.body || "",
    icon: "/icon-192-v3.png",
    badge: "/icon-192-v3.png",
    data: { href: data.href || "/" },
    tag: data.tag || undefined,
  };
  const tasks = [self.registration.showNotification(title, options)];
  // App icon badge (iOS 16.4+ home-screen apps, Android, desktop PWAs).
  if (typeof data.unreadCount === "number" || typeof data.badge === "number") {
    const count = typeof data.unreadCount === "number" ? data.unreadCount : data.badge;
    if (self.navigator && "setAppBadge" in self.navigator) {
      tasks.push(
        (count > 0
          ? self.navigator.setAppBadge(count)
          : self.navigator.clearAppBadge()
        ).catch(() => {}),
      );
    }
  }
  event.waitUntil(Promise.all(tasks));
});

// Focus an existing hub tab (or open one) when a notification is tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(href);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(href);
      }),
  );
});
