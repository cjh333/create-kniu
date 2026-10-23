// 必须以同源静态脚本形式交付，构建器将本文件复制到 public/kniu-sw.js。
const VERSION = 'kniu-runtime-v2';
const CACHEABLE_DESTINATIONS = new Set(['document', 'script', 'style', 'image', 'font', 'manifest']);

function isCacheable(request) {
  const url = new URL(request.url);
  return request.method === 'GET' && url.origin === self.location.origin && !url.pathname.startsWith('/api/') && (request.mode === 'navigate' || CACHEABLE_DESTINATIONS.has(request.destination));
}

self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(Promise.all([caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('kniu-runtime-') && key !== VERSION).map((key) => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', (event) => {
  if (!isCacheable(event.request)) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) caches.open(VERSION).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request)));
});
