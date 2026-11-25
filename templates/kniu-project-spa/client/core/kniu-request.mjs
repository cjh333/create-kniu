function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  return String(globalThis.document?.cookie || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix))?.slice(prefix.length) || '';
}
import { getContracts } from './Kniu-Contracts.mjs';
import { createWorkerRequest } from './Kniu-WorkerRequest.mjs';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isSafeMethod = (method) => ['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
const DEFAULT_CACHE_LIMIT = 200;
const DEFAULT_SWEEP_INTERVAL = 50;

export const REQUEST_WORKER_URL = '/client/core/Kniu-RequestWorker.mjs';

async function parseBodyByType(response, requestInit) {
  const type = String(requestInit?.responseType || '').toLowerCase();
  if (type === 'blob') return response.blob();
  if (type === 'arraybuffer') return response.arrayBuffer();
  if (type === 'json') return response.json();
  if (type === 'text') return response.text();
  return (response.headers.get('content-type') || '').includes('json')
    ? await response.json()
    : await response.text();
}

export function createRequest(options = {}) {
  const interceptors = new Set();
  const inFlight = new Map();
  const cache = new Map();
  const cacheOrder = new Map();
  let lastCsrfToken = '';
  const cacheLimit = Math.max(1, Number(options.cacheLimit) || DEFAULT_CACHE_LIMIT);
  const sweepInterval = Math.max(1, Number(options.sweepInterval) || DEFAULT_SWEEP_INTERVAL);
  let writesSinceSweep = 0;
  const defaults = {
    method: 'GET',
    headers: { Accept: 'application/json' },
    traceHeader: 'X-Request-ID',
    credentials: options.credentials || 'same-origin',
    timeout: Number(options.timeout) || getContracts().limits?.requestTimeout || 15_000,
    retries: Number(options.retries) || 0,
    retryDelay: Number(options.retryDelay) || 300,
    retryOnNetworkError: options.retryOnNetworkError !== false,
    csrfCookie: options.csrfCookie || '',
    csrfHeader: options.csrfHeader || getContracts().http.csrfHeader,
    getAccessToken: options.getAccessToken,
    deduplicate: options.deduplicate !== undefined ? options.deduplicate : true,
    ...options
  };
  const workerTransport = options.workerUrl && typeof Worker === 'function'
    ? createWorkerRequest({ workerUrl: options.workerUrl, csrfCookie: options.csrfCookie, csrfHeader: defaults.csrfHeader, timeout: options.timeout, returnResponse: true })
    : null;
  let trackingActive = false;
  let trackingWindow = new Set();
  let trackingGeneration = 0;
  const trackOperation = (operation) => {
    if (!trackingActive) return;
    trackingWindow.add(operation);
    const release = () => trackingWindow.delete(operation);
    operation.then(release, release);
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

  const FETCH_OPTION_KEYS = new Set(['method', 'headers', 'body', 'signal', 'cache', 'mode', 'credentials', 'redirect', 'referrer', 'referrerPolicy', 'integrity', 'keepalive']);

  function buildFetchOptions(requestInit) {
    const fetchOptions = {};
    for (const key of Object.keys(requestInit)) {
      if (FETCH_OPTION_KEYS.has(key) && requestInit[key] !== undefined) {
        fetchOptions[key] = requestInit[key];
      }
    }
    if (fetchOptions.cache === true) fetchOptions.cache = 'default';
    return fetchOptions;
  }

  const request = async (url, init = {}) => {
    const requestInit = { ...defaults, ...init };
    const authVersion = requestInit.getAuthVersion?.();
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
      let csrfRetried = false;
      const maxRetries = isSafeMethod(method) || requestInit.retryUnsafe === true ? Math.max(0, Number(requestInit.retries)) : 0;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        let sentCsrf = '';
        const controller = new AbortController();
        const onExternalAbort = () => controller.abort();
        if (requestInit.signal) {
          if (requestInit.signal.aborted) controller.abort();
          else requestInit.signal.addEventListener('abort', onExternalAbort, { once: true });
        }
        const timer = Number(requestInit.timeout) > 0 ? setTimeout(() => controller.abort(), Number(requestInit.timeout)) : null;
        try {
          const headers = new Headers({ ...defaults.headers, ...(requestInit.headers || {}) });
          if (!isSafeMethod(method) && requestInit.body && !(requestInit.body instanceof FormData) && !headers.has('content-type')) {
            headers.set('Content-Type', 'application/json');
          }
          const traceId = requestInit.traceId || globalThis.crypto?.randomUUID?.();
          if (traceId && !headers.has(requestInit.traceHeader || defaults.traceHeader)) headers.set(requestInit.traceHeader || defaults.traceHeader, traceId);
          const token = requestInit.auth === false ? '' : await (requestInit.getAccessToken || defaults.getAccessToken)?.();
          if (token) headers.set('Authorization', `${getContracts().http.authScheme} ${token}`.trim());
          if (!isSafeMethod(method)) {
            sentCsrf = requestInit.csrfToken || lastCsrfToken || (defaults.csrfCookie ? decodeURIComponent(readCookie(defaults.csrfCookie)) : '');
            if (sentCsrf && !headers.has(defaults.csrfHeader)) headers.set(defaults.csrfHeader, sentCsrf);
          }
          const fetchOptions = { ...buildFetchOptions(requestInit), method, headers, signal: controller.signal };
          const response = workerTransport && !(fetchOptions.body instanceof FormData)
            ? await workerTransport.request(url, fetchOptions).then((result) => new Response(JSON.stringify(result.data), { status: result.status, statusText: result.statusText, headers: { 'content-type': 'application/json', ...(result.headers || {}) } }))
            : await fetch(url, fetchOptions);
          const deliveredCsrf = response.headers.get(String(defaults.csrfHeader || getContracts().http.csrfHeader));
          if (deliveredCsrf) lastCsrfToken = deliveredCsrf;
          const httpContracts = getContracts().http;
          const body = typeof httpContracts.parseBody === 'function'
            ? await httpContracts.parseBody(response, { url, requestInit })
            : await parseBodyByType(response, requestInit);
          const result = { ok: response.ok, status: response.status, headers: response.headers, data: body, response, authVersion };
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
          const rotateContracts = getContracts().http;
          const rotatedCsrf = String(error.headers?.get?.(defaults.csrfHeader) || '');
          if (!csrfRetried && Number(error.status) === Number(rotateContracts.csrfRotateStatus) && Number(error.data?.status) === Number(rotateContracts.csrfRotateCode) && rotatedCsrf && rotatedCsrf !== sentCsrf) {
            csrfRetried = true;
            lastCsrfToken = rotatedCsrf;
            attempt -= 1;
            continue;
          }
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
      trackOperation(operation);
      try { return await operation; } finally { inFlight.delete(key); }
    }
    trackOperation(operation);
    return operation;
  };
  return Object.assign(request, {
    get: (url, init) => request(url, { ...init, method: 'GET' }),
    post: (url, body, init = {}) => {
      if (body instanceof FormData) return request(url, { ...init, method: 'POST', body });
      return request(url, { ...init, method: 'POST', headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }, body: JSON.stringify(body) });
    },
    clearCache: (url, init = {}) => cache.delete(cacheKey(url, init)),
    clearAllCache() { cache.clear(); cacheOrder.clear(); },
    useResponseInterceptor(interceptor) { interceptors.add(interceptor); return () => interceptors.delete(interceptor); },
    beginRequestTracking() {
      trackingActive = true;
      trackingWindow = new Set();
      trackingGeneration += 1;
    },
    requestTrackingSettled(timeout = 4000) {
      const generation = trackingGeneration;
      const isCurrent = () => generation === trackingGeneration;
      if (!trackingActive || !trackingWindow.size) {
        if (isCurrent()) trackingActive = false;
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const finish = () => {
          if (isCurrent()) trackingActive = false;
          resolve();
        };
        const deadline = Date.now() + timeout;
        let quiet = 0;
        const check = () => {
          if (!isCurrent()) return finish();
          if (Date.now() >= deadline) return finish();
          if (!trackingWindow.size) {
            quiet += 1;
            if (quiet >= 2) return finish();
          } else {
            quiet = 0;
          }
          setTimeout(check, 40);
        };
        check();
      });
    }
  });
}

export const REQUEST = { name: 'request', install(app) { app.request = createRequest(app.config?.request); } };