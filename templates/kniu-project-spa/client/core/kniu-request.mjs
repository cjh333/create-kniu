function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  return document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix))?.slice(prefix.length) || '';
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isSafeMethod = (method) => ['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());

export function createRequest(options = {}) {
  const interceptors = new Set();
  const inFlight = new Map();
  const cache = new Map();
  const defaults = {
    method: 'GET',
    headers: { Accept: 'application/json' },
    traceHeader: 'X-Request-ID',
    credentials: options.credentials || 'same-origin',
    timeout: Number(options.timeout) || 15_000,
    retries: Number(options.retries) || 0,
    retryDelay: Number(options.retryDelay) || 300,
    csrfCookie: options.csrfCookie || '',
    csrfHeader: options.csrfHeader || 'X-CSRF-Token',
    getAccessToken: options.getAccessToken,
    ...options
  };
  const cacheKey = (url, init) => `${String(init.method || 'GET').toUpperCase()} ${url}`;

  const request = async (url, init = {}) => {
    const requestInit = { ...defaults, ...init };
    const method = String(requestInit.method || 'GET').toUpperCase();
    const key = cacheKey(url, requestInit);
    const ttl = Number(requestInit.cacheTtl || 0);
    if (requestInit.cache === true && isSafeMethod(method)) {
      const cached = cache.get(key);
      if (cached?.expiresAt > Date.now()) return cached.value;
      if (inFlight.has(key)) return inFlight.get(key);
    }
    const operation = (async () => {
      let lastError;
      const maxRetries = isSafeMethod(method) || requestInit.retryUnsafe === true ? Math.max(0, Number(requestInit.retries)) : 0;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = requestInit.signal ? null : new AbortController();
        const timer = controller && Number(requestInit.timeout) > 0 ? setTimeout(() => controller.abort(), Number(requestInit.timeout)) : null;
        try {
          const headers = new Headers({ ...defaults.headers, ...(requestInit.headers || {}) });
          const traceId = requestInit.traceId || globalThis.crypto?.randomUUID?.();
          if (traceId && !headers.has(requestInit.traceHeader || defaults.traceHeader)) headers.set(requestInit.traceHeader || defaults.traceHeader, traceId);
          const token = requestInit.auth === false ? '' : await (requestInit.getAccessToken || defaults.getAccessToken)?.();
          if (token) headers.set('Authorization', `Bearer ${token}`);
          const csrf = requestInit.csrfToken || (defaults.csrfCookie ? decodeURIComponent(readCookie(defaults.csrfCookie)) : '');
          if (csrf && !headers.has(defaults.csrfHeader)) headers.set(defaults.csrfHeader, csrf);
          const response = await fetch(url, { ...requestInit, method, headers, signal: requestInit.signal || controller?.signal });
          const type = response.headers.get('content-type') || '';
          const body = type.includes('json') ? await response.json() : await response.text();
          const result = { ok: response.ok, status: response.status, headers: response.headers, data: body, response };
          for (const interceptor of interceptors) await interceptor(result);
          if (!response.ok) throw Object.assign(new Error(`请求失败：${response.status} ${response.statusText}`), result);
          if (requestInit.cache === true && ttl > 0) cache.set(key, { value: body, expiresAt: Date.now() + ttl });
          return body;
        } catch (error) {
          lastError = error;
          const retryableStatus = Number(error.status || 0);
          if (attempt >= maxRetries || (retryableStatus && retryableStatus < 500 && retryableStatus !== 429)) throw error;
          await wait(Number(requestInit.retryDelay) * (2 ** attempt));
        } finally { if (timer) clearTimeout(timer); }
      }
      throw lastError;
    })();
    if (requestInit.cache === true && isSafeMethod(method)) {
      inFlight.set(key, operation);
      try { return await operation; } finally { inFlight.delete(key); }
    }
    return operation;
  };
  return Object.assign(request, {
    get: (url, init) => request(url, { ...init, method: 'GET' }),
    post: (url, body, init = {}) => request(url, { ...init, method: 'POST', headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }, body: JSON.stringify(body) }),
    clearCache: (url, init = {}) => cache.delete(cacheKey(url, init)),
    useResponseInterceptor(interceptor) { interceptors.add(interceptor); return () => interceptors.delete(interceptor); }
  });
}

export const REQUEST = { name: 'request', install(app) { app.request = createRequest(app.config?.request); } };
