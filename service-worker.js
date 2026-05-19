const CACHE_NAME = 'quran-app-v11';
const API_CACHE = 'quran-api-cache-v3';
const AUDIO_CACHE = 'quran-audio-cache-v1';
const AUDIO_CACHE_LIMIT = 200;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './azan.mp3',
  './app.js',
  './styles.css',
  './data/quranRoots.json'
];

const API_HOSTS = ['alquran.cloud', 'aladhan.com', 'cdn.jsdelivr.net'];
const AUDIO_HOST = 'cdn.islamic.network';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c =>
      c.addAll(STATIC_ASSETS).catch(err => console.warn('Some assets failed:', err))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k =>
        ![CACHE_NAME, API_CACHE, AUDIO_CACHE].includes(k) ? caches.delete(k) : null
      ))
    )
  );
  self.clients.claim();
});

// تنظيف كاش الصوت عند تجاوز الحد الأقصى
async function trimAudioCache() {
  const cache = await caches.open(AUDIO_CACHE);
  const keys = await cache.keys();
  if (keys.length > AUDIO_CACHE_LIMIT) {
    const toDelete = keys.slice(0, keys.length - AUDIO_CACHE_LIMIT);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // ملفات الصوت: Cache First (أقصى سرعة)
  if (url.hostname.includes(AUDIO_HOST)) {
    e.respondWith(
      caches.open(AUDIO_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const res = await fetch(e.request);
          if (res && res.status === 200) {
            cache.put(e.request, res.clone()).then(() => trimAudioCache()).catch(() => {});
          }
          return res;
        } catch {
          return new Response('', { status: 503 });
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

  // الأصول الثابتة: Cache First
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
