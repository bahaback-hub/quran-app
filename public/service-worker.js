const CACHE_NAME = 'quran-app-v13';
const API_CACHE = 'quran-api-cache-v3';
const AUDIO_CACHE = 'quran-audio-cache-v1';
const MUSHARAF_CACHE = 'quran-mushaf-v1';
const AUDIO_CACHE_LIMIT = 300;
const MUSHARAF_CACHE_LIMIT = 604;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './azan.mp3',
];

const API_HOSTS = ['alquran.cloud', 'aladhan.com'];
const CDN_HOSTS = ['cdn.jsdelivr.net'];
const AUDIO_HOST = 'cdn.islamic.network';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c =>
      c.addAll(STATIC_ASSETS).catch(err => console.warn('Some assets failed:', err))
    ).then(() => {
      // Pre-cache first 10 mushaf pages from local
      const pages = [];
      for (let i = 1; i <= 10; i++) {
        const padded = String(i).padStart(3, '0');
        pages.push(`./public/pages/page${padded}.png`);
      }
      return caches.open(MUSHARAF_CACHE).then(cache =>
        Promise.allSettled(pages.map(url =>
          cache.add(url).catch(() => {})
        ))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k =>
        ![CACHE_NAME, API_CACHE, AUDIO_CACHE, MUSHARAF_CACHE].includes(k) ? caches.delete(k) : null
      ))
    )
  );
  self.clients.claim();
});

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > limit) {
    const toDelete = keys.slice(0, keys.length - limit);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Audio files: Cache First
  if (url.hostname.includes(AUDIO_HOST)) {
    e.respondWith(
      caches.open(AUDIO_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const res = await fetch(e.request);
          if (res && res.status === 200) {
            cache.put(e.request, res.clone()).then(() => trimCache(AUDIO_CACHE, AUDIO_CACHE_LIMIT)).catch(() => {});
          }
          return res;
        } catch {
          return new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // Mushaf page images: Cache First
  if (url.pathname.includes('/pages/page') && url.pathname.endsWith('.png')) {
    e.respondWith(
      caches.open(MUSHARAF_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const res = await fetch(e.request);
          if (res && res.status === 200) {
            cache.put(e.request, res.clone()).then(() => trimCache(MUSHARAF_CACHE, MUSHARAF_CACHE_LIMIT)).catch(() => {});
          }
          return res;
        } catch {
          return caches.match('./icon-512.png');
        }
      })
    );
    return;
  }

  // API: Stale-While-Revalidate
  const isApi = API_HOSTS.some(host => url.hostname.includes(host));
  if (isApi) {
    e.respondWith(
      caches.open(API_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const networkPromise = fetch(e.request).then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            cache.put(e.request, res.clone()).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || networkPromise;
      })
    );
    return;
  }

  // Everything else (including Vite-built assets): Network First,
  // fallback to cache then index.html
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type !== 'opaque') {
        try { const clone = res.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {}); } catch (e) { /* clone failed */ }
      }
      return res;
    }).catch(async () => {
      const cached = await caches.match(e.request);
      return cached || caches.match('./index.html');
    })
  );
});
