import AUTH from './kniuauth.mjs';
import KniuUI from './kniuui.js';

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
    data: null,
    dataType: 'json',
    headers: {},
    credentials: 'include'
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

  function createFailureResult(httpStatus, msg, request) {
    return { status: 0, msg, data: null, httpStatus, request };
  }

  // 防止多个并发请求同时返回 401 时重复跳转登录页。
  let isAuthenticationRedirecting = false;
  function handleAuthenticationExpired() {
    if (isAuthenticationRedirecting) return;
    isAuthenticationRedirecting = true;
    try {
      sessionStorage.removeItem('kniu_authed');
      AUTH.markLoggedOut();
      if (typeof location !== 'undefined' && location.hash !== '#/login') {
        location.hash = '/login';
      }
    } catch (e) {

    }
    setTimeout(function resetAuthenticationRedirect() { isAuthenticationRedirecting = false; }, 1000);
  }

  async function executeRequest(rawRequest) {
    const request = normalizeRequest(rawRequest);
    const url = buildRequestUrl(request.url, request.data, request.type);
    const hasBody = FETCH_METHODS.includes(request.type);
    const fetchInit = {
      method: request.type,
      headers: { ...request.headers },
      credentials: request.credentials,
    };
    if (hasBody && request.data != null) {
      if (typeof FormData !== 'undefined' && request.data instanceof FormData) {
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
        const status = Number(body.status) === 1 ? 1 : 0;
        const msg = body.msg || (response.ok ? 'success' : 'error');
        const data = body.data !== undefined ? body.data : null;
        if (httpStatus === 401) handleAuthenticationExpired();
        return { status, msg, data, httpStatus, request };
      }
      if (httpStatus === 401) handleAuthenticationExpired();
      return response.ok
        ? { status: 1, msg: 'success', data: parsed, httpStatus, request }
        : createFailureResult(httpStatus, `请求失败（HTTP ${httpStatus}）`, request);
    } catch (networkError) {
      return createFailureResult(0, networkError.message || '网络请求异常', request);
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
        : `${normalized.type}:${normalized.url}:${JSON.stringify(normalized.data ?? null)}`;
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
      const httpSucceeded = result.httpStatus >= 200 && result.httpStatus < 300;
      const callbackContext = {
        $msg: KniuUI.msg,
        $confirm: KniuUI.confirm
      };
      try {
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

export default KniuRequest.sendRequests;
