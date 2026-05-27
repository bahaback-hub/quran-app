const CACHE = {
  APP: 'quran-app-v14',
  API: 'quran-api-cache-v4',
  AUDIO: 'quran-audio-cache-v2',
  MUSHARAF: 'quran-mushaf-v2',
  QURAN_DATA: 'quran-full-text-v1',
  LAYOUT: 'quran-layout-v1'
};

const AUDIO_LIMIT = 300;
const MUSHARAF_LIMIT = 604;

const ASSETS = [
  './',
  './index.html',
  './app.bundle.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './azan.mp3'
];

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/bahaback-hub/quran-app@main/public/pages/';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE.APP).then(c => c.addAll(ASSETS).catch(() => {}))
    .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  const valid = Object.values(CACHE);
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => valid.includes(k) ? null : caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > limit) {
    await Promise.all(keys.slice(0, keys.length - limit).map(k => cache.delete(k)));
  }
}

function isCDNPage(url) {
  return url.href.includes('pages/page') && url.href.endsWith('.png');
}

function isAudio(url) {
  return url.hostname.includes('cdn.islamic.network');
}

function isAPI(url) {
  return url.hostname.includes('alquran.cloud') || url.hostname.includes('aladhan.com');
}

function isQuranData(url) {
  return url.pathname.includes('/quran/quran-uthmani');
}

function isLayoutData(url) {
  return url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('mushaf-layout') && url.pathname.endsWith('.json');
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Full Quran text: cache-first, never expire
  if (isQuranData(url)) {
    e.respondWith(
      caches.open(CACHE.QURAN_DATA).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Layout data from mushaf-layout: cache-first
  if (isLayoutData(url)) {
    e.respondWith(
      caches.open(CACHE.LAYOUT).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // CDN mushaf pages: cache-first
  if (isCDNPage(url)) {
    e.respondWith(
      caches.open(CACHE.MUSHARAF).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const res = await fetch(e.request);
        if (res.ok) {
          cache.put(e.request, res.clone()).then(() => trim(CACHE.MUSHARAF, MUSHARAF_LIMIT));
        }
        return res;
      }).catch(() => caches.match(CACHE.APP + '/icon-512.png'))
    );
    return;
  }

  // Audio: cache-first
  if (isAudio(url)) {
    e.respondWith(
      caches.open(CACHE.AUDIO).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const res = await fetch(e.request);
        if (res.ok) {
          cache.put(e.request, res.clone()).then(() => trim(CACHE.AUDIO, AUDIO_LIMIT));
        }
        return res;
      }).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // API calls: stale-while-revalidate
  if (isAPI(url)) {
    e.respondWith(
      caches.open(CACHE.API).then(async cache => {
        const cached = await cache.match(e.request);
        const net = fetch(e.request).then(res => {
          if (res.ok && res.type !== 'opaque') cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // Everything else: network-first, fallback to cache then index.html
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && res.type !== 'opaque') {
        caches.open(CACHE.APP).then(c => c.put(e.request, res.clone()));
      }
      return res;
    }).catch(async () => {
      const cached = await caches.match(e.request);
      return cached || caches.match('./index.html');
    })
  );
});
