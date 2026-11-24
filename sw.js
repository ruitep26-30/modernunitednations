/**
 * Modern United Nations - High-Performance Asset Cache Service Worker
 * Intercepts Cloudflare R2 committee emblems and media to provide:
 * 1. Cache-First asset delivery: 0ms local load times for delegates.
 * 2. Zero-cost shield: Prevents repeated Class B operations against Cloudflare R2.
 * 3. Offline resilience: Cached emblems remain visible even during network degradation.
 */

const CACHE_NAME = 'mun-r2-assets-v2';
const R2_HOST = 'pub-bb97002249104aefa199ab0938792ec2.r2.dev';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('mun-r2-assets-')) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Strictly target Cloudflare R2 committee asset requests
  if (requestUrl.hostname === R2_HOST && requestUrl.pathname.startsWith('/committees/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // 1. Check local persistent Cache Storage
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. Fetch once from Cloudflare R2 CDN
        try {
          const networkResponse = await fetch(event.request, {
            mode: 'cors',
            credentials: 'omit'
          });

          // Cache only valid successful image responses
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (fetchErr) {
          // If network fails (offline), attempt to fallback to any matching cached response
          if (cachedResponse) {
            return cachedResponse;
          }
          throw fetchErr;
        }
      })
    );
  }
  // All other requests pass through untouched
});

