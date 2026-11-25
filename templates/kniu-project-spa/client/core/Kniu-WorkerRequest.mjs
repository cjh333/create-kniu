import { getContracts, limitValue } from './Kniu-Contracts.mjs';

const sharedRequests = globalThis.__kniuWorkerRequests || (globalThis.__kniuWorkerRequests = new Map());

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  return String(globalThis.document?.cookie || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix))?.slice(prefix.length) || '';
}

function decodeCookie(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function normalizeInit(init = {}) {
  const source = init && typeof init === 'object' ? init : {};
  return {
    method: String(source.method || 'GET').toUpperCase(),
    headers: Object.fromEntries(new Headers(source.headers || {}).entries()),
    body: source.body,
    credentials: source.credentials || 'same-origin',
    cache: source.cache,
    mode: source.mode,
    redirect: source.redirect,
    referrerPolicy: source.referrerPolicy
  };
}

async function fetchOnMainThread(url, init, returnResponse = false) {
  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('json') ? await response.json() : await response.text();
  if (returnResponse) return { ok: response.ok, status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()), data };
  if (!response.ok) throw Object.assign(new Error(`请求失败：${response.status} ${response.statusText}`), { status: response.status, data });
  return data;
}

export function createWorkerRequest(options = {}) {
  const timeout = Math.max(0, Number(options.timeout) || limitValue('workerTimeout', 30_000));
  const configuredUrl = String(options.workerUrl || '').trim();
  const csrfCookie = String(options.csrfCookie || '').trim();
  const csrfHeader = String(options.csrfHeader || getContracts().http.csrfHeader);
  const enabled = options.enabled !== false && typeof Worker === 'function' && configuredUrl !== '';
  const pending = new Map();
  let sequence = 0;
  let worker = null;
  let workerBroken = false;

  function rejectAll(error) {
    pending.forEach(({ reject, timer }) => { if (timer) clearTimeout(timer); reject(error); });
    pending.clear();
  }

  function ensureWorker() {
    if (!enabled || workerBroken || worker) return worker;
    try {
      const workerUrl = new URL(configuredUrl, globalThis.location?.href || undefined);
      if (options.allowCrossOrigin !== true && globalThis.location?.origin && workerUrl.origin !== globalThis.location.origin) {
        throw new Error('Worker 地址必须同源；如确需跨域，请显式设置 allowCrossOrigin。');
      }
      worker = new Worker(workerUrl, { type: 'module', name: 'kniu-request' });
    } catch {
      worker = null;
      return null;
    }
    worker.onmessage = (event) => {
      const message = event.data || {};
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (entry.timer) clearTimeout(entry.timer);
      if (message.type === 'response') {
        if (message.result?.ok || options.returnResponse) entry.resolve(options.returnResponse ? message.result : message.result.data);
        else entry.reject(Object.assign(new Error(`请求失败：${message.result?.status || 0} ${message.result?.statusText || ''}`.trim()), message.result || {}));
      } else entry.reject(Object.assign(new Error(message.error?.message || 'Worker 请求失败'), message.error || {}));
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Worker 初始化失败');
      workerBroken = true;
      worker?.terminate();
      worker = null;
      const queued = [...pending.values()];
      pending.clear();
      for (const entry of queued) {
        if (entry.timer) clearTimeout(entry.timer);
        if (!entry.url) { entry.reject(error); continue; }
        const fallbackTimer = timeout ? setTimeout(() => {
          entry.reject(Object.assign(new Error(`请求超时：${timeout}ms`), { name: 'TimeoutError' }));
        }, timeout) : null;
        fetchOnMainThread(entry.url, entry.init, options.returnResponse).then(
          (data) => { if (fallbackTimer) clearTimeout(fallbackTimer); entry.resolve(data); },
          (fallbackError) => { if (fallbackTimer) clearTimeout(fallbackTimer); entry.reject(fallbackError); }
        );
      }
    };
    const httpContracts = getContracts().http;
    worker.postMessage({ type: 'configure', csrfHeader, csrfRotateStatus: httpContracts.csrfRotateStatus, csrfRotateCode: httpContracts.csrfRotateCode });
    return worker;
  }

  function performRequest(url, init = {}) {
    const normalized = normalizeInit(init);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(normalized.method) && csrfCookie && !normalized.headers[csrfHeader.toLowerCase()]) {
      const token = readCookie(csrfCookie);
      if (token) normalized.headers[csrfHeader] = decodeCookie(token);
    }
    const activeWorker = ensureWorker();
    if (!activeWorker) return fetchOnMainThread(url, normalized, options.returnResponse);
    const id = `Kniu-WorkerRequest-${++sequence}`;
    let abort = () => { };
    const promise = new Promise((resolve, reject) => {
      const timer = timeout ? setTimeout(() => {
        pending.delete(id);
        activeWorker.postMessage({ type: 'abort', id });
        reject(Object.assign(new Error(`请求超时：${timeout}ms`), { name: 'TimeoutError' }));
      }, timeout) : null;
      abort = () => {
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        if (entry.timer) clearTimeout(entry.timer);
        activeWorker.postMessage({ type: 'abort', id });
        reject(Object.assign(new Error('请求已取消'), { name: 'AbortError' }));
      };
      pending.set(id, { resolve, reject, timer, url: String(url), init: normalized });
      activeWorker.postMessage({ type: 'request', id, url: String(url), init: normalized });
    });
    return Object.assign(promise, { abort });
  }

  function request(url, init = {}) {
    const method = String(init.method || 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? init.body : '';
    const key = `${method} ${String(url)} ${body}`;
    if (sharedRequests.has(key)) return sharedRequests.get(key);
    const promise = performRequest(url, init);
    sharedRequests.set(key, promise);
    promise.finally(() => { if (sharedRequests.get(key) === promise) sharedRequests.delete(key); }).catch(() => { });
    return promise;
  }

  return Object.freeze({
    request,
    get: (url, init = {}) => request(url, { ...init, method: 'GET' }),
    post: (url, body, init = {}) => request(url, {
      ...init,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers || {}) },
      body: JSON.stringify(body == null ? {} : body)
    }),
    terminate() {
      rejectAll(Object.assign(new Error('Worker 已关闭'), { name: 'AbortError' }));
      worker?.terminate();
      worker = null;
    }
  });
}

export default createWorkerRequest;