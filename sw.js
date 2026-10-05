// F1 GRID: isolate this app's cache from other apps on the same GitHub Pages host.
const CACHE_PREFIX = 'f1-grid-' + new URL(self.registration.scope).pathname + '-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const STATIC_ASSETS = [
    './', './index.html', './styles.css', './modern.css', './season-data.js',
    './core.js', './modern.js', './pwa.js', './manifest.json', './icons/icon.svg',
    './assets/hero-car.webp', './assets/manrope.woff', './assets/unbounded.woff',
    './assets/news-tech.svg', './assets/news-track.svg', './assets/news-paddock.svg',
    './data/news.json'
];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.hostname === 'api.jolpi.ca') {
        event.respondWith(networkFirst(request, 9000));
    } else if (url.origin === self.location.origin) {
        const network = request.mode === 'navigate' || /\.(?:html|js|css|json)$/.test(url.pathname);
        event.respondWith(network ? networkFirst(request, 5000) : cacheFirst(request));
    }
});
async function timedFetch(request, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try { return await fetch(request, { signal: controller.signal }); }
    finally { clearTimeout(timer); }
}
async function remember(cache, request, response) {
    if (response.ok) { try { await cache.put(request, response.clone()); } catch (_) {} }
    return response;
}
async function networkFirst(request, timeout) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await timedFetch(request, timeout);
        if (response.ok) return remember(cache, request, response);
        const cached = await cache.match(request);
        return cached || response;
    } catch (_) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
            const page = await cache.match(new URL('./index.html', self.registration.scope).href);
            if (page) return page;
        }
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
}
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try { return remember(cache, request, await fetch(request)); }
    catch (_) { return new Response('Offline', { status: 503 }); }
}
