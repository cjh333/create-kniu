function safePayload(value) {
  try { return JSON.stringify(value); } catch { return ''; }
}

function createObservability(options = {}) {
  const configuredEndpoint = String(options.endpoint || '');
  let endpoint = '';
  try {
    const target = new URL(configuredEndpoint, location.origin);
    if (target.origin === location.origin || options.allowCrossOrigin === true) endpoint = target.href;
  } catch {}
  const enabled = options.enabled === true && endpoint !== '';
  const send = (type, detail = {}) => {
    if (!enabled) return false;
    const pageUrl = new URL(location.href);
    pageUrl.search = '';
    pageUrl.hash = '';
    const body = safePayload({
      type,
      detail,
      url: pageUrl.href,
      timestamp: new Date().toISOString()
    });
    if (!body) return false;
    if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }))) return true;
    fetch(endpoint, { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
    return true;
  };
  const normalizeError = (error) => ({
    message: String(error?.message || error || 'Unknown error').slice(0, 1000),
    stack: String(error?.stack || '').slice(0, 4000)
  });
  return Object.freeze({
    enabled,
    send,
    install() {
      if (!enabled) return;
      addEventListener('error', (event) => send('error', normalizeError(event.error || event.message)));
      addEventListener('unhandledrejection', (event) => send('unhandledrejection', normalizeError(event.reason)));
      if (typeof PerformanceObserver !== 'function') return;
      const report = (entry) => send('web-vital', { name: entry.name, value: entry.value, rating: entry.value > 2500 ? 'poor' : entry.value > 1200 ? 'needs-improvement' : 'good' });
      try { new PerformanceObserver((list) => list.getEntries().forEach(report)).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
      try { new PerformanceObserver((list) => list.getEntries().forEach(report)).observe({ type: 'layout-shift', buffered: true }); } catch {}
      try { new PerformanceObserver((list) => list.getEntries().forEach(report)).observe({ type: 'interaction-to-next-paint', buffered: true }); } catch {}
    }
  });
}

export { createObservability };
export default createObservability;
