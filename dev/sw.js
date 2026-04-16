// ═══════════════════════════════════════════════
// 태민이 마일리지 — Service Worker (Push + Cache)
// ═══════════════════════════════════════════════

const CACHE_NAME = 'taemin-v4';

// Install — skip waiting to activate immediately
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Activate — claim clients + clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      )
    ).then(() => clients.claim())
  );
});

// Fetch — Network-first strategy for HTML, network-only for API calls
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  // Skip cross-origin requests (Firebase, APIs, CDNs)
  if (url.origin !== self.location.origin) return;

  // HTML pages (index.html, /, etc.) — Network first, fallback to cache
  if (e.request.mode === 'navigate' || e.request.destination === 'document' ||
      url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(response => {
          // Cache the fresh response for offline fallback
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        })
        .catch(() => {
          // Network failed — serve from cache (offline support)
          return caches.match(e.request);
        })
    );
    return;
  }

  // Static assets (icons, manifest) — Cache first, then network
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|json)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
});

// Push — receive push notification
self.addEventListener('push', (e) => {
  let data = { title: '태민이 마일리지', body: '알림이 도착했어요!', icon: 'icon-180.png' };

  if (e.data) {
    try {
      data = { ...data, ...e.data.json() };
    } catch (err) {
      data.body = e.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'icon-180.png',
    badge: 'icon-96.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'default',
    renotify: true,
    data: {
      url: data.url || './',
      type: data.type || 'general',
      from: data.from || null,
      msgText: data.msgText || null,
      mood: data.mood || null,
      dateOfArrival: Date.now()
    },
    actions: data.actions || []
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then(clients => {
        clients.forEach(c => c.postMessage({ type: 'PUSH_RECEIVED' }));
      })
  );
});

// Notification click — open app and pass data
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const notifData = e.notification.data || {};
  const urlToOpen = notifData.url || './';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and send message data
      for (const client of clientList) {
        if ((client.url.includes('taemin_mileage') || client.url.includes('index.html')) && 'focus' in client) {
          client.focus();
          // Send notification data to the app
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: notifData
          });
          return;
        }
      }
      // Otherwise open new window with query params
      let openUrl = urlToOpen;
      if (notifData.type === 'family_msg' && notifData.from) {
        openUrl += '?showMsg=1&from=' + notifData.from;
      }
      return clients.openWindow(openUrl);
    })
  );
});
