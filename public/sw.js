// Family Board service worker — makes the app installable (Chrome PWA),
// shows push notifications and focuses the app when one is tapped.

// Minimal fetch handler. Its presence is what makes the app installable; it
// stays a pass-through so the live board/kid data is never served stale. A
// navigation that fails while offline falls back to a tiny inline page.
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><style>body{font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#ede9fe;color:#4c1d95;text-align:center}</style><body><div><h1>You're offline</h1><p>Reconnect to see the family board.</p></div>",
            { headers: { "Content-Type": "text/html" } }
          )
      )
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "Family Board";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-parent.svg",
    badge: "/icon-parent.svg",
    data: { url: data.url || "/me" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/me";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
