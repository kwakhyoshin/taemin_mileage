// ═══════════════════════════════════════════════
// 태민이 마일리지 — Service Worker (Push + Cache)
// ═══════════════════════════════════════════════
// [PERF B1] Stale-While-Revalidate for HTML — 캐시 즉시 반환 + 백그라운드 네트워크 갱신
// 새 HTML 도착 시 클라이언트에 postMessage('HTML_UPDATED') 로 알림
// 다음 리로드 시 자동 반영 (강제 새로고침 없이 자연스럽게 업데이트)

const CACHE_NAME = 'taemin-v5';

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

// Fetch — [PERF B1] Stale-While-Revalidate for HTML
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  // Skip cross-origin requests (Firebase, APIs, CDNs)
  if (url.origin !== self.location.origin) return;

  // HTML pages (index.html, /, etc.) — Stale-While-Revalidate
  // 캐시가 있으면 즉시 반환 (부팅 RTT 제거) + 백그라운드에서 네트워크로 갱신
  // 갱신된 HTML이 도착하면 클라이언트에 'HTML_UPDATED' 메시지 전송
  if (e.request.mode === 'navigate' || e.request.destination === 'document' ||
      url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      const networkPromise = fetch(e.request, { cache: 'no-cache' })
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            // 캐시 저장 (백그라운드)
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
            // 캐시가 있었다면 HTML 갱신 알림 (캐시 첫 저장 시에는 알릴 필요 없음)
            if (cached) {
              self.clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(clientList => {
                  clientList.forEach(c => c.postMessage({ type: 'HTML_UPDATED' }));
                });
            }
          }
          return response;
        })
        .catch(() => cached); // 네트워크 실패 시 캐시 폴백
      // 캐시가 있으면 즉시 반환, 없으면 네트워크 대기
      return cached || networkPromise;
    })());
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
