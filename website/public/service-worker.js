const CACHE_NAME = 'my-pwa-cache-v1';
const urlsToCache = [
    '/',
    '/manifest.json',
    '/assets/favicon.ico', // Ensure these paths are correct
    '/assets/Logo.png', // Ensure these paths are correct
    '/public/styles/index.css',
    '/public/styles/404500.css',
    '/public/styles/addItem.css',
    '/public/styles/addTag.css',
    '/public/styles/header.css',
    '/public/styles/login.css',
    '/public/styles/product.css',
    '/public/styles/stats.css',
];

// Install the service worker and cache specified files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
});

// Fetch event to serve cached files
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// Activate the service worker and clean up old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});