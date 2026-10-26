export function createServiceWorkerPlugin(options = {}) {
  return {
    name: 'service-worker',
    async install() {
      if (options.enabled !== true || !('serviceWorker' in navigator)) return;
      const url = options.url || '/public/assets/kniu-sw.js';
      const scope = options.scope || '/public/assets/';
      const normalizedScope = scope.endsWith('/') ? scope : scope + '/';
      const safeScope = url.startsWith(normalizedScope) || normalizedScope.startsWith(url.replace(/[^/]+$/, ''))
        ? normalizedScope
        : url.replace(/[^/]+$/, '');
      await navigator.serviceWorker.register(url, { scope: safeScope });
    }
  };
}

export default createServiceWorkerPlugin;