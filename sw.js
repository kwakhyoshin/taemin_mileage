// ═══════════════════════════════════════════════
// 태민이 마일리지 — Service Worker (Push + Cache)
// ═══════════════════════════════════════════════

const CACHE_NAME = 'taemin-v1';

// Install — cache essential files
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
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
    badge: 'icon-180.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './',
      dateOfArrival: Date.now()
    },
    actions: data.actions || []
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click — open app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const urlToOpen = e.notification.data?.url || './';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(urlToOpen);
    })
  );
});
