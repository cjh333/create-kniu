function safePayload(value) {
  try { return JSON.stringify(value); } catch { return ''; }
}

function createObservability(options = {}) {
  const configuredEndpoint = String(options.endpoint || '');
  let endpoint = '';
  if (configuredEndpoint) {
    try {
      const target = new URL(configuredEndpoint, location.origin);
      if (target.origin === location.origin || options.allowCrossOrigin === true) endpoint = target.href;
    } catch { }
  }
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
    fetch(endpoint, { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body }).catch(() => { });
    return true;
  };
  const REDACT_PATTERNS = [
    [/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [redacted]'],
    [/(?<=["':\s])(?:eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,})/g, '[jwt-redacted]'],
    [/(?<=["':\s])[A-Za-z0-9_\-]{32,}(?=["'\s,;)]|$)/g, '[token-redacted]'],
    [/(?<=["':\s])(?:[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/g, '[email-redacted]'],
    [/(?<=["':\s])\d{13,19}(?=["'\s,;)]|$)/g, '[id-redacted]']
  ];
  function redact(value) {
    if (typeof value !== 'string') return value;
    return REDACT_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), value);
  }
  const normalizeError = (error) => ({
    message: redact(String(error?.message || error || 'Unknown error').slice(0, 1000)),
    stack: redact(String(error?.stack || '').slice(0, 4000))
  });
  let installed = false;
  let observers = [];
  return Object.freeze({
    enabled,
    send,
    install() {
      if (!enabled) return;
      if (installed) return;
      installed = true;
      addEventListener('error', (event) => {
        if (event instanceof ErrorEvent) send('error', normalizeError(event.error || event.message));
      });
      addEventListener('unhandledrejection', (event) => send('unhandledrejection', normalizeError(event.reason)));
      if (typeof PerformanceObserver !== 'function') return;
      const rateVital = (entry) => {
        let rating;
        if (entry.name === 'layout-shift') {
          rating = entry.value > 0.25 ? 'poor' : entry.value > 0.1 ? 'needs-improvement' : 'good';
        } else if (entry.name === 'largest-contentful-paint') {
          rating = entry.value > 4000 ? 'poor' : entry.value > 2500 ? 'needs-improvement' : 'good';
        } else if (entry.name === 'interaction-to-next-paint') {
          rating = entry.value > 500 ? 'poor' : entry.value > 200 ? 'needs-improvement' : 'good';
        } else {
          rating = entry.value > 2500 ? 'poor' : entry.value > 1200 ? 'needs-improvement' : 'good';
        }
        send('web-vital', { name: entry.name, value: entry.value, rating });
      };
      const observeType = (type) => {
        try { observers.push(new PerformanceObserver((list) => list.getEntries().forEach(rateVital)).observe({ type, buffered: true })); } catch { }
      };
      observeType('largest-contentful-paint');
      observeType('layout-shift');
      observeType('interaction-to-next-paint');
    },
    uninstall() {
      if (!installed) return;
      installed = false;
      observers.forEach((observer) => { try { observer.disconnect(); } catch { } });
      observers = [];
    }
  });
}

export { createObservability };
export default createObservability;