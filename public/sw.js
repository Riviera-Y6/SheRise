const CACHE = 'we-rise-shell-v4';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'We-Rise Admin';
  const options = {
    body: payload.body || 'There is a new We-Rise admin notification.',
    icon: '/we-rise-emblem.svg',
    badge: '/we-rise-emblem.svg',
    tag: payload.tag || (payload.notification_id ? `we-rise-admin-${payload.notification_id}` : 'we-rise-admin'),
    renotify: true,
    data: {
      url: payload.url || '/admin',
      member_key: payload.member_key || null,
      notification_id: payload.notification_id || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const destination = new URL(data.url || '/admin', self.location.origin);
  if (data.member_key) destination.searchParams.set('member', data.member_key);
  if (data.notification_id) destination.searchParams.set('notification', String(data.notification_id));

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      try {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(destination.toString());
          return client.focus();
        }
      } catch {}
    }
    return self.clients.openWindow(destination.toString());
  })());
});
