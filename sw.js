// Service worker: app shell + data are cached for offline use.
// Map tiles are intentionally NOT cached (OpenStreetMap tile policy discourages bulk caching).
const VERSION = 'pujo-v22';
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/style.css', 'img/icon.svg',
  'pages/explore.html', 'pages/pandal.html', 'pages/map.html', 'pages/metro.html',
  'pages/metro-station.html', 'pages/planner.html', 'pages/favourites.html', 'pages/guide.html',
  'js/app.js', 'js/main.js', 'js/state.js', 'js/i18n.js', 'js/data.js', 'js/geo.js', 'js/metro.js',
  'js/route.js', 'js/share.js', 'js/timeline.js', 'js/map.js', 'js/ui.js',
  'data/pandals.json', 'data/metro.json', 'data/config.json'
];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const fresh = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || fresh;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) return e.respondWith(networkFirst(req));
  if (CDN_HOSTS.includes(url.hostname)) return e.respondWith(staleWhileRevalidate(req));
  // everything else (OSM tiles, Google Maps links) goes straight to the network
});
