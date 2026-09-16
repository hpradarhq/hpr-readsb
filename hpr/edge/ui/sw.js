/* HPR Edge app-shell cache. Only active on secure contexts (https/localhost);
 * the appliance is usually plain http on the LAN, so registration is guarded. */
const CACHE = 'hpr-edge-v1';
const SHELL = ['/', '/index.html', '/airwire-adapter.js', '/aircraft-renderer.js', '/station-context.js', '/hpr-config.js', '/edge-g1-list.css'];

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {}))); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin !== location.origin) return;
  if (u.pathname.startsWith('/ws/') || u.pathname.startsWith('/api/') || u.pathname.startsWith('/data/')) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok && res.type === 'basic') c.put(e.request, res.clone()); return res; }).catch(() => r))));
});
