// ==========================================================================
// Melodiax Service Worker
// - Sirf "app shell" (HTML/CSS/JS/icons) cache karta hai, taake site khud
//   bina internet ke bhi khul jaye.
// - /api/* (login, songs list, playlists) hamesha live/network se - offline
//   hone par ye fail honi hi chahiye, kyunki data live/database se aata hai.
// - Audio/Video files is service worker se cache nahi hote - "Download for
//   offline" button (offline.js) unhe khud IndexedDB me save karta hai,
//   taake sirf user ke chune hue gaane hi storage use karein, sab kuch nahi.
// ==========================================================================

// __CACHE_VERSION__ ko server.js dynamically replace karta hai (shell files ke
// content-hash se) - taake har deploy/change pe khud-ba-khud naya cache bane,
// aur kisi ko yahan manually version badhane ki zaroorat na pade.
const CACHE_NAME = 'melodiax-shell-__CACHE_VERSION__';
const APP_SHELL = [
    '/',
    '/Index.html',
    '/Style.css',
    '/Script.js',
    '/playlist.js',
    '/playlist-banner.js',
    '/admin.js',
    '/auth.js',
    '/confirm.js',
    '/offline.js',
    '/manifest.json',
    '/favicon.ico'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .catch((err) => console.warn('SW: app shell cache nahi ho saka', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => Promise.all(
            names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Sirf apni site (same-origin) ki files cache karte hain - external CDN
    // (Google Fonts, Font Awesome) browser ka apna HTTP cache sambhal leta hai.
    if (url.origin !== self.location.origin) return;

    // Live/database data - kabhi cache nahi karte.
    if (url.pathname.startsWith('/api/')) return;

    // Audio/video/uploads - offline.js (IndexedDB) is scope se bahar rakhta hai.
    if (
        url.pathname.startsWith('/Audio/') ||
        url.pathname.startsWith('/Videos/') ||
        url.pathname.startsWith('/uploads/')
    ) return;

    // Stale-while-revalidate: cache mojood ho to turant wahi do (fast +
    // offline-capable), sath hi background me network se fresh copy le kar
    // cache update kar dete hain agli baar ke liye.
    event.respondWith(
        caches.match(req).then((cached) => {
            const networkFetch = fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const resClone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                    }
                    return res;
                })
                .catch(() => cached);
            return cached || networkFetch;
        })
    );
});
