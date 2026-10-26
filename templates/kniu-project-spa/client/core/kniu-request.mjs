function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  return document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix))?.slice(prefix.length) || '';
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isSafeMethod = (method) => ['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
const DEFAULT_CACHE_LIMIT = 200;
const DEFAULT_SWEEP_INTERVAL = 50;

export function createRequest(options = {}) {
  const interceptors = new Set();
  const inFlight = new Map();
  const cache = new Map();
  const cacheOrder = new Map();
  const cacheLimit = Math.max(1, Number(options.cacheLimit) || DEFAULT_CACHE_LIMIT);
  const sweepInterval = Math.max(1, Number(options.sweepInterval) || DEFAULT_SWEEP_INTERVAL);
  let writesSinceSweep = 0;
  const defaults = {
    method: 'GET',
    headers: { Accept: 'application/json' },
    traceHeader: 'X-Request-ID',
    credentials: options.credentials || 'same-origin',
    timeout: Number(options.timeout) || 15_000,
    retries: Number(options.retries) || 0,
    retryDelay: Number(options.retryDelay) || 300,
    retryOnNetworkError: options.retryOnNetworkError !== false,
    csrfCookie: options.csrfCookie || '',
    csrfHeader: options.csrfHeader || 'X-CSRF-Token',
    getAccessToken: options.getAccessToken,
    deduplicate: options.deduplicate !== undefined ? options.deduplicate : true,
    ...options
  };
  const cacheKey = (url, init) => `${String(init.method || 'GET').toUpperCase()} ${url}`;

  function sweepCache() {
    const now = Date.now();
    cache.forEach((entry, key) => {
      if (!entry || entry.expiresAt <= now) cache.delete(key);
    });
    while (cache.size > cacheLimit) {
      let oldestKey = null;
      let oldestAt = Infinity;
      cacheOrder.forEach((at, key) => {
        if (cache.has(key) && at < oldestAt) { oldestAt = at; oldestKey = key; }
      });
      if (oldestKey == null) break;
      cache.delete(oldestKey);
      cacheOrder.delete(oldestKey);
    }
  }

    // fetch 允许的键，其余自定义字段须在展开前剔除。
  const FETCH_OPTION_KEYS = new Set(['method', 'headers', 'body', 'signal', 'cache', 'mode', 'credentials', 'redirect', 'referrer', 'referrerPolicy', 'integrity', 'keepalive']);

  function buildFetchOptions(requestInit) {
    const fetchOptions = {};
    for (const key of Object.keys(requestInit)) {
      if (FETCH_OPTION_KEYS.has(key) && requestInit[key] !== undefined) {
        fetchOptions[key] = requestInit[key];
      }
    }
    // cache 是布尔值时降级为 'default'，避免传入 fetch 导致静默降级。
    if (fetchOptions.cache === true) fetchOptions.cache = 'default';
    return fetchOptions;
  }

  const request = async (url, init = {}) => {
    const requestInit = { ...defaults, ...init };
    const method = String(requestInit.method || 'GET').toUpperCase();
    const key = cacheKey(url, requestInit);
    const ttl = Number(requestInit.cacheTtl || 0);
    const deduplicate = requestInit.deduplicate !== undefined ? requestInit.deduplicate : true;
    if (requestInit.cache === true && isSafeMethod(method)) {
      const cached = cache.get(key);
      if (cached?.expiresAt > Date.now()) {
        const cachedResult = { ok: true, status: cached.status ?? 200, headers: new Headers(cached.headers ?? {}), data: cached.value, response: null };
        for (const interceptor of interceptors) await interceptor(cachedResult);
        return cached.value;
      }
      if (deduplicate && inFlight.has(key)) return inFlight.get(key);
    } else if (deduplicate && inFlight.has(key)) {
      return inFlight.get(key);
    }
    const operation = (async () => {
      let lastError;
      const maxRetries = isSafeMethod(method) || requestInit.retryUnsafe === true ? Math.max(0, Number(requestInit.retries)) : 0;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const onExternalAbort = () => controller.abort();
        if (requestInit.signal) {
          if (requestInit.signal.aborted) controller.abort();
          else requestInit.signal.addEventListener('abort', onExternalAbort, { once: true });
        }
        const timer = Number(requestInit.timeout) > 0 ? setTimeout(() => controller.abort(), Number(requestInit.timeout)) : null;
        try {
          const headers = new Headers({ ...defaults.headers, ...(requestInit.headers || {}) });
          // 有 body 时若未显式设 Content-Type，自动补 application/json。
          if (!isSafeMethod(method) && requestInit.body && !headers.has('content-type')) {
            headers.set('Content-Type', 'application/json');
          }
          const traceId = requestInit.traceId || globalThis.crypto?.randomUUID?.();
          if (traceId && !headers.has(requestInit.traceHeader || defaults.traceHeader)) headers.set(requestInit.traceHeader || defaults.traceHeader, traceId);
          const token = requestInit.auth === false ? '' : await (requestInit.getAccessToken || defaults.getAccessToken)?.();
          if (token) headers.set('Authorization', `Bearer ${token}`);
          if (!isSafeMethod(method)) {
            const csrf = requestInit.csrfToken || (defaults.csrfCookie ? decodeURIComponent(readCookie(defaults.csrfCookie)) : '');
            if (csrf && !headers.has(defaults.csrfHeader)) headers.set(defaults.csrfHeader, csrf);
          }
          const response = await fetch(url, { ...buildFetchOptions(requestInit), method, headers, signal: controller.signal });
          const type = response.headers.get('content-type') || '';
          const body = type.includes('json') ? await response.json() : await response.text();
          const result = { ok: response.ok, status: response.status, headers: response.headers, data: body, response };
          for (const interceptor of interceptors) await interceptor(result);
          if (!response.ok) throw Object.assign(new Error(`请求失败：${response.status} ${response.statusText}`), result);
          if (requestInit.cache === true && ttl > 0) {
            cache.set(key, { value: body, status: response.status, expiresAt: Date.now() + ttl });
            cacheOrder.set(key, Date.now());
            if (++writesSinceSweep >= sweepInterval) { writesSinceSweep = 0; sweepCache(); }
          }
          return body;
        } catch (error) {
          lastError = error;
          const isNetworkError = error.status === undefined || error.status === 0;
          const retryableStatus = Number(error.status || 0);
          const networkRetryable = requestInit.retryOnNetworkError !== false && isNetworkError;
          if (attempt >= maxRetries || (retryableStatus && retryableStatus < 500 && retryableStatus !== 429 && !networkRetryable)) throw error;
          await wait(Number(requestInit.retryDelay) * (2 ** attempt));
        } finally {
          if (timer) clearTimeout(timer);
          if (requestInit.signal) requestInit.signal.removeEventListener('abort', onExternalAbort);
        }
      }
      throw lastError;
    })();
    if (deduplicate) {
      inFlight.set(key, operation);
      try { return await operation; } finally { inFlight.delete(key); }
    }
    return operation;
  };
  return Object.assign(request, {
    get: (url, init) => request(url, { ...init, method: 'GET' }),
    post: (url, body, init = {}) => request(url, { ...init, method: 'POST', headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }, body: JSON.stringify(body) }),
    clearCache: (url, init = {}) => cache.delete(cacheKey(url, init)),
    clearAllCache() { cache.clear(); cacheOrder.clear(); },
    useResponseInterceptor(interceptor) { interceptors.add(interceptor); return () => interceptors.delete(interceptor); }
  });
}

export const REQUEST = { name: 'request', install(app) { app.request = createRequest(app.config?.request); } };