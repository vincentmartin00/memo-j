// Mémo J — service worker : l'app s'ouvre même sans réseau, et recevra les notifications.
const CACHE = 'memo-j-v3';
const FICHIERS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/algo.js', './vendor/supabase.js',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // les données (Supabase) passent toujours par le réseau
  if (url.hostname.endsWith('supabase.co')) return;
  // fichiers de l'app : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (url.origin === location.origin || url.hostname.includes('fonts.g'))) {
          const copie = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copie));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});

// Notifications (activées à l'étape suivante)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Mémo J', body: e.data?.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'Mémo J', {
      body: d.body || '', icon: './icons/icon-192.png', badge: './icons/icon-192.png', data: { url: d.url || './#/aujourdhui' },
    });
    if (typeof d.badge === 'number' && self.navigator?.setAppBadge) {
      try { await (d.badge ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge()); } catch (_) {}
    }
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const cible = e.notification.data?.url || './#/aujourdhui';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { c.navigate(cible); return c.focus(); }
    return self.clients.openWindow(cible);
  }));
});
