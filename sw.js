// ===== F1 2026 SERVICE WORKER =====
const CACHE_NAME = 'f1-2026-v4';
const CACHE_TIMEOUT = 10 * 60 * 1000; // 10 минут для API

// Файлы для кэша при установке (оффлайн-оболочка)
const STATIC_ASSETS = [
    './',
    './index.html',
    './script.js',
    './styles.css',
    './manifest.json',
    './icons/icon.svg',
];

// ===== УСТАНОВКА: кэшируем статику =====
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Кэшируем статические файлы...');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// ===== АКТИВАЦИЯ: удаляем старые кэши =====
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Удаляем старый кэш:', key);
                        return caches.delete(key);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// ===== ПЕРЕХВАТ ЗАПРОСОВ =====
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // API-запросы — сначала сеть, при ошибке — кэш
    if (url.hostname === 'api.openf1.org' || url.hostname === 'api.jolpi.ca') {
        event.respondWith(networkFirstWithCache(request));
        return;
    }

    // Внешние изображения (логотипы F1) — сначала кэш, при промахе — сеть
    if (url.hostname === 'www.formula1.com' || url.hostname === 'i.vimeocdn.com') {
        event.respondWith(cacheFirstWithNetwork(request));
        return;
    }

    // Локальные файлы сайта — сначала кэш, при промахе — сеть
    event.respondWith(cacheFirstWithNetwork(request));
});

// Стратегия: сначала сеть, при ошибке — кэш (для API)
async function networkFirstWithCache(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const networkResp = await fetchWithTimeout(request.clone(), 8000);
        if (networkResp.ok) {
            // Сохраняем свежий ответ в кэш
            cache.put(request, networkResp.clone());
        }
        return networkResp;
    } catch (err) {
        // Сеть недоступна — пробуем кэш
        const cached = await cache.match(request);
        if (cached) {
            console.log('[SW] Оффлайн — отдаём из кэша:', request.url);
            return cached;
        }
        // Ничего нет — возвращаем JSON с ошибкой
        return new Response(
            JSON.stringify({ error: 'Офлайн-режим: данные недоступны' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// Стратегия: сначала кэш, при промахе — сеть (для статики и изображений)
async function cacheFirstWithNetwork(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
        return cached;
    }
    try {
        const networkResp = await fetch(request);
        if (networkResp.ok) {
            cache.put(request, networkResp.clone());
        }
        return networkResp;
    } catch (err) {
        // Возвращаем оффлайн-страницу если всё совсем плохо
        const offlinePage = await cache.match('./index.html');
        return offlinePage || new Response('Нет подключения к сети', { status: 503 });
    }
}

// Fetch с таймаутом
function fetchWithTimeout(request, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout')), ms);
        fetch(request).then(resp => {
            clearTimeout(timer);
            resolve(resp);
        }).catch(err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
