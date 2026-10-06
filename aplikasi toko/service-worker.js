// service-worker.js — Toko Kita PWA

const CACHE_NAME = 'toko-kita-v1';

// File yang di-cache saat install (shell aplikasi)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/style.css',
    '/manifest.json',
    // CDN — akan di-cache saat pertama diakses
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/vue@3/dist/vue.global.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

// ===== INSTALL: Pre-cache static assets =====
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(
                // Hanya cache file lokal saat install; CDN di-cache saat fetch
                ['/', '/index.html', '/app.js', '/style.css', '/manifest.json']
            ))
            .catch(err => console.warn('[SW] Install cache error:', err))
    );
    self.skipWaiting();
});

// ===== ACTIVATE: Hapus cache lama =====
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== CACHE_NAME)
                    .map(k => {
                        console.log('[SW] Deleting old cache:', k);
                        return caches.delete(k);
                    })
            )
        )
    );
    self.clients.claim();
});

// ===== FETCH: Strategi Network-first, fallback cache =====
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Abaikan request non-GET
    if (event.request.method !== 'GET') return;

    // Abaikan request Supabase API (harus online untuk data segar)
    if (url.hostname.includes('supabase.co')) return;

    // Abaikan request socket/websocket
    if (event.request.url.startsWith('chrome-extension')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cache response yang berhasil
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                // Offline: ambil dari cache
                return caches.match(event.request)
                    .then(cached => {
                        if (cached) return cached;
                        // Fallback ke index.html untuk navigasi
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

