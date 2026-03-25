// ═══════════════════════════════════════════════
// 태민이 마일리지 — Service Worker (Push + Cache)
// ═══════════════════════════════════════════════

const CACHE_NAME = 'taemin-v3';

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
