const CACHE_VERSION = 'kniu-runtime-v2';
const CACHEABLE_DESTINATIONS = new Set(['document', 'script', 'style', 'image', 'font', 'manifest']);

function isServiceWorkerRuntime() {
  return typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;
}

function isCacheable(request) {
  const url = new URL(request.url);
  return request.method === 'GET'
    && url.origin === self.location.origin
    && (request.mode === 'navigate' || CACHEABLE_DESTINATIONS.has(request.destination));
}

function installWorkerRuntime() {
  self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
  self.addEventListener('activate', (event) => event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('kniu-runtime-') && key !== CACHE_VERSION).map((key) => caches.delete(key))
    )),
    self.clients.claim()
  ])));
  self.addEventListener('fetch', (event) => {
    if (!isCacheable(event.request)) return;
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request)));
  });
}

if (isServiceWorkerRuntime()) installWorkerRuntime();

export const SERVICE_WORKER_URL = '/public/assets/Kniu-Sw.mjs';

export function createServiceWorkerPlugin(options = {}) {
  return {
    name: 'service-worker',
    async install() {
      if (options.enabled !== true || !('serviceWorker' in navigator)) return;
      const url = SERVICE_WORKER_URL;
      const scope = url.replace(/[^/]+$/, '');
      const normalizedScope = scope.endsWith('/') ? scope : scope + '/';
      const safeScope = url.startsWith(normalizedScope) || normalizedScope.startsWith(url.replace(/[^/]+$/, ''))
        ? normalizedScope
        : url.replace(/[^/]+$/, '');
      await navigator.serviceWorker.register(url, { scope: safeScope, type: 'module' });
    }
  };
}

export default createServiceWorkerPlugin;