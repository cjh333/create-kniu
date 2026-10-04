import AUTH from './kniuauth.mjs';
import UI from './kniuui/kniuui.js';
import { createStateStore } from './kniustore.mjs';

const STATUS_SUCCESS = 1;
const STATUS_UNAUTHORIZED = 1001;
const requestState = createStateStore('request');
let authRedirectHandler = null;
function authRedirect(handler) {
  authRedirectHandler = typeof handler === 'function' ? handler : null;
}

var KniuRequest = (function () {
  const nativeFetch =
    (typeof globalThis !== 'undefined' && globalThis.fetch) ? globalThis.fetch : undefined;
  const FETCH_API_PREFIX = '/api';
  const FETCH_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
  const FETCH_RESPONSE_TYPES = {
    json: function (res) { return res.json(); },
    text: function (res) { return res.text(); },
    blob: function (res) { return res.blob(); },
    formData: function (res) { return res.formData(); },
    arrayBuffer: function (res) { return res.arrayBuffer(); },
  };
  const FETCH_DEFAULT_REQUEST = {
    type: 'GET',
    mutation: true,
    data: null,
    dataType: 'json',
    headers: {},
    credentials: 'include',
    timeout: 15000
  };

  function normalizeRequest(raw = {}) {
    return {
      ...FETCH_DEFAULT_REQUEST,
      ...raw,
      type: (raw.type || FETCH_DEFAULT_REQUEST.type).toUpperCase(),
      dataType: raw.dataType || raw.responseType || FETCH_DEFAULT_REQUEST.dataType,
      headers: { ...FETCH_DEFAULT_REQUEST.headers, ...raw.headers },
    };
  }

  function buildRequestUrl(url, data, type) {
    const fullUrl = /^https?:\/\//.test(url) ? url : `${FETCH_API_PREFIX}${url}`;
    if (FETCH_METHODS.includes(type) || data == null) return fullUrl;
    const query = new URLSearchParams(data).toString();
    return query ? `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}${query}` : fullUrl;
  }

  function createFailureResult(httpStatus, msg, request, aborted = false) {
    return { status: 0, msg, data: null, httpStatus, request, aborted };
  }

  function toStateValue(value) {
    if (typeof FormData !== 'undefined' && value instanceof FormData) {
      return [...value.entries()].map(function ([name, item]) {
        if (typeof File !== 'undefined' && item instanceof File) {
          return [name, { name: item.name, size: item.size, type: item.type }];
        }
        return [name, item];
      });
    }
    return value == null ? null : value;
  }

  function fingerprint(value) {
    const source = stableSerialize(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${source.length}:${(hash >>> 0).toString(16)}`;
  }

  function toStateSummary(value) {
    const normalized = toStateValue(value);
    if (Array.isArray(normalized)) {
      return { type: 'array', length: normalized.length, fingerprint: fingerprint(normalized) };
    }
    if (normalized && typeof normalized === 'object') {
      return {
        type: 'object',
        keys: Object.keys(normalized).sort(),
        id: normalized.id ?? null,
        revision: normalized.revision ?? null,
        total: normalized.total ?? null,
        fingerprint: fingerprint(normalized)
      };
    }
    return { type: typeof normalized, value: normalized, fingerprint: fingerprint(normalized) };
  }

  async function trackMutationState(result) {
    if (!result || result.status !== STATUS_SUCCESS || !result.request?.mutation) return;
    const request = result.request;
    await requestState.dispatch('mutation', {
      method: request.type,
      url: request.url,
      request: toStateSummary(request.data),
      response: toStateSummary(result.data)
    });
  }

  function stableSerialize(value, seen = new WeakSet()) {
    if (value === null || typeof value !== 'object') {
      if (typeof value === 'undefined') return '"[undefined]"';
      if (typeof value === 'number' && Number.isNaN(value)) return '"[NaN]"';
      return JSON.stringify(value);
    }
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
    if (Array.isArray(value)) {
      const result = '[' + value.map(function (item) { return stableSerialize(item, seen); }).join(',') + ']';
      seen.delete(value);
      return result;
    }
    const result = '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + stableSerialize(value[key], seen);
    }).join(',') + '}';
    seen.delete(value);
    return result;
  }

  function handleAuthenticationExpired() {
    try {
      const hash = String(globalThis.location?.hash || '');
      if (hash.startsWith('#/login') || hash.startsWith('#/register')) return;
      sessionStorage.removeItem('kniu_authed');
      AUTH.markLoggedOut();
      if (authRedirectHandler) authRedirectHandler();
      else if (typeof location !== 'undefined') location.hash = '/login';
    } catch (e) {

    }
  }

  async function executeRequest(rawRequest) {
    const request = normalizeRequest(rawRequest);
    const url = buildRequestUrl(request.url, request.data, request.type);
    const hasBody = FETCH_METHODS.includes(request.type);
    const isFormData = typeof FormData !== 'undefined' && request.data instanceof FormData;
    const timeoutMs = Number(request.timeout) || 0;
    const explicitTimeout = !!(rawRequest && typeof rawRequest === 'object' && rawRequest.timeout !== undefined);
    const applyTimeout = timeoutMs > 0 && (!isFormData || explicitTimeout);
    let timeoutController = null;
    let timeoutTimer = null;
    let fetchSignal = request.signal || undefined;
    if (applyTimeout) {
      timeoutController = new AbortController();
      if (request.signal) {
        if (request.signal.aborted) timeoutController.abort();
        else request.signal.addEventListener('abort', function forwardAbort() {
          timeoutController.abort();
        });
      }
      timeoutTimer = setTimeout(function triggerTimeout() {
        timeoutController.abort();
      }, timeoutMs);
      fetchSignal = timeoutController.signal;
    }
    const fetchInit = {
      method: request.type,
      headers: { ...request.headers },
      credentials: request.credentials,
      signal: fetchSignal,
    };
    if (hasBody && request.data != null) {
      if (isFormData) {
        Object.keys(fetchInit.headers).forEach(function (name) {
          if (name.toLowerCase() === 'content-type') delete fetchInit.headers[name];
        });
        fetchInit.body = request.data;
      } else {
        fetchInit.headers['Content-Type'] =
          fetchInit.headers['Content-Type'] || 'application/json';
        fetchInit.body = JSON.stringify(request.data);
      }
    }
    try {
      const response = await nativeFetch(url, fetchInit);
      const httpStatus = response.status;
      const parse = FETCH_RESPONSE_TYPES[request.dataType] || FETCH_RESPONSE_TYPES.json;
      let parsed = null;
      try {
        parsed = await parse(response);
      } catch (parseError) {
        return createFailureResult(httpStatus, `响应解析失败：${parseError.message}`, request);
      }
      if (request.dataType === 'json') {
        const body = parsed && typeof parsed === 'object' ? parsed : {};
        const status = Number(body.status) || 0;
        const msg = body.msg || (response.ok ? 'success' : 'error');
        const data = body.data !== undefined ? body.data : null;
        if ((httpStatus === 401 || status === STATUS_UNAUTHORIZED) && request.redirectOnUnauthorized !== false) {
          handleAuthenticationExpired();
        }
        return { status, msg, data, httpStatus, request };
      }
      if (httpStatus === 401 && request.redirectOnUnauthorized !== false) handleAuthenticationExpired();
      return response.ok
        ? { status: 1, msg: 'success', data: parsed, httpStatus, request }
        : createFailureResult(httpStatus, `请求失败（HTTP ${httpStatus}）`, request);
    } catch (networkError) {
      const externallyAborted = request.signal && request.signal.aborted === true;
      const timedOut = !externallyAborted && timeoutController && timeoutController.signal.aborted === true;
      if (timedOut) {
        return createFailureResult(0, `请求超时（${timeoutMs}ms）`, request, false);
      }
      const aborted = networkError && networkError.name === 'AbortError' || externallyAborted;
      return createFailureResult(0, aborted ? '请求已取消' : ((networkError && networkError.message) || '网络请求异常'), request, aborted);
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }
  }

  const REQUEST_DEDUP = new Map();
  async function sendRequests(requests = []) {
    const isSingle = !Array.isArray(requests);
    const list = isSingle ? [requests] : requests;
    const settled = await Promise.allSettled(list.map(function (req) {
      const normalized = normalizeRequest(req);
      const isFormData = typeof FormData !== 'undefined' && normalized.data instanceof FormData;
      const key = isFormData
        ? `${normalized.type}:${normalized.url}:form-data:${Math.random()}`
        : `${normalized.type}:${buildRequestUrl(normalized.url, normalized.data, normalized.type)}:${normalized.dataType}:${stableSerialize(normalized.data ?? null)}`;
      const ongoing = REQUEST_DEDUP.get(key);
      if (ongoing) return ongoing;
      const promise = executeRequest(req).finally(function clearPendingRequest() {
        if (REQUEST_DEDUP.get(key) === promise) REQUEST_DEDUP.delete(key);
      });
      REQUEST_DEDUP.set(key, promise);
      return promise;
    }));
    const results = settled.map(function (item) {
      return item.status === 'fulfilled'
        ? item.value
        : createFailureResult(0, item.reason?.message || '未知错误', null);
    },
    );
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const config = list[index];
      if (!config) continue;
      if (result.aborted) continue;
      const httpSucceeded = result.httpStatus >= 200 && result.httpStatus < 300;
      const callbackContext = {
        $msg: UI.msg,
        $confirm: UI.confirm
      };
      try {
        await trackMutationState(result);
        if (httpSucceeded) await config.success?.call(callbackContext, result);
        else await config.fail?.call(callbackContext, result);
      } finally {
        await config.complete?.call(callbackContext, result);
      }
    }
    return isSingle ? results[0] : results;
  }

  return { sendRequests };
}());

const sendRequests = KniuRequest.sendRequests;

export default sendRequests;
export { STATUS_SUCCESS, STATUS_UNAUTHORIZED, requestState, authRedirect };