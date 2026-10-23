export function createServiceWorkerPlugin(options = {}) {
  return {
    name: 'service-worker',
    async install() {
      if (options.enabled !== true || !('serviceWorker' in navigator)) return;
      await navigator.serviceWorker.register(options.url || '/kniu-sw.js', { scope: options.scope || '/' });
    }
  };
}

export default createServiceWorkerPlugin;
