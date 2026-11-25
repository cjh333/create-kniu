import { getContracts, responseRecords, failureResult } from './Kniu-Contracts.mjs';
import { adoptDocumentStyle } from './Kniu-Runtime.mjs';

export function resolveAliasReferences(source, aliases = {}) {
  return Object.entries(aliases)
    .sort(function ([left], [right]) { return right.length - left.length; })
    .reduce(function (result, [alias, target]) {
      const aliasPrefix = alias.replace(/\/+$/g, '') + '/';
      const normalizedTarget = String(target)
        .replaceAll('\\', '/')
        .replace(/^\.\//, '')
        .replace(/^\/+|\/+$/g, '');
      const targetPrefix = normalizedTarget ? `/${normalizedTarget}/` : '/';
      return result.replaceAll(aliasPrefix, targetPrefix);
    }, String(source));
}

export function getCurrentRoutePath() {
  const hash = String(globalThis.location?.hash || '').slice(1) || '/';
  return hash.split('?')[0].split('#')[0] || '/';
}

export function getRouteQuery() {
  const hash = String(globalThis.location?.hash || '');
  const index = hash.indexOf('?');
  if (index === -1) return {};
  const out = {};
  new URLSearchParams(hash.slice(index + 1).split('#', 1)[0]).forEach(function (value, key) {
    if (key) out[key] = value;
  });
  return out;
}

export function getRouteData() {
  const routeData = globalThis.history?.state?.kniuRouteData;
  return routeData?.path === getCurrentRoutePath() && routeData.data && typeof routeData.data === 'object'
    ? routeData.data : {};
}

export function getRouteContext(getRouteData, keys) {
  let data = null;
  try { data = typeof getRouteData === 'function' ? getRouteData() : null; } catch (e) { data = null; }
  const merged = { ...getRouteQuery(), ...(data && typeof data === 'object' ? data : null) };
  const out = {};
  (keys || []).forEach(function (key) {
    const value = merged[key];
    out[key] = value === null || value === undefined ? '' : String(value);
  });
  return out;
}

export function getLocalDateParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = function (number) { return String(number).padStart(2, '0'); };
  return {
    year: date.getFullYear(),
    month: pad(date.getMonth() + 1),
    date: pad(date.getDate()),
    week: date.getDay(),
    hour: pad(date.getHours()),
    minute: pad(date.getMinutes()),
    second: pad(date.getSeconds())
  };
}

export function formatLocalDateTime(value = new Date()) {
  const parts = getLocalDateParts(value);
  return `${parts.year}-${parts.month}-${parts.date} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatTime(value = new Date(), locale = 'zh-CN') {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString(locale, { hour12: false });
}

export function getTimeInZone(timezone, value = new Date()) {
  const zone = String(timezone || '').trim();
  if (!zone) return value instanceof Date ? new Date(value) : new Date(value);
  try {
    return new Date(new Date(value).toLocaleString('en-US', { timeZone: zone }));
  } catch (_) {
    return value instanceof Date ? new Date(value) : new Date(value);
  }
}

export function buildMultipartFormData(model = {}, options = {}) {
  const formData = new FormData();
  const fileField = String(options.fileField || getContracts().http.uploadFileField);
  const files = Array.isArray(options.files) ? options.files : [];

  Object.keys(model || {}).forEach(function (field) {
    if (field === fileField) return;
    const value = model[field];
    formData.append(field, value == null ? '' : value);
  });

  const newFile = files.find(function (item) {
    return typeof File !== 'undefined' && item instanceof File;
  });
  const storedFile = files.find(function (item) {
    return typeof item === 'string' && item.length > 0;
  });

  if (newFile) formData.append(fileField, newFile, newFile.name);
  else formData.append(fileField, storedFile || '');
  return formData;
}

export function getResponseRecords(payload) {
  return responseRecords(payload);
}

function getFirstResponseRecord(payload) {
  return getResponseRecords(payload)[0] || null;
}

export function assignModelFields(target, source, emptyValue = '') {
  if (!target || typeof target !== 'object' || !source || typeof source !== 'object') return target;
  Object.keys(target).forEach(function (field) {
    target[field] = source[field] == null ? emptyValue : source[field];
  });
  return target;
}

export function assignOptionFields(options, source, emptyValue = '') {
  if (!options || typeof options !== 'object' || !source || typeof source !== 'object') return options;
  Object.keys(options).forEach(function (field) {
    const value = source[field] == null ? emptyValue : source[field];
    const slot = options[field];
    if (slot && typeof slot === 'object' && 'value' in slot) slot.value = value;
    else options[field] = value;
  });
  return options;
}

export function fillOptionsFromResponse(options, payload, emptyValue = '') {
  const record = getFirstResponseRecord(payload);
  if (!record) return null;
  assignOptionFields(options, record, emptyValue);
  return record;
}

export function optionsToValues(options) {
  const out = {};
  if (!options || typeof options !== 'object') return out;
  Object.keys(options).forEach(function (field) {
    const slot = options[field];
    out[field] = slot && typeof slot === 'object' && 'value' in slot ? slot.value : slot;
  });
  return out;
}

export function readFieldValue(source, fallback = '') {
  const value = source && typeof source === 'object' && 'value' in source ? source.value : source;
  return value == null ? fallback : value;
}

function field(value, condition, message) {
  return { value: value == null ? '' : value, condition: condition, message: String(message || '') };
}

export function required(message = '此项不能为空', value = '') {
  return field(value, true, message);
}

export function toSingleFileList(value) {
  return value ? [value] : [];
}

export function updateListRecord(list, changes, key = 'id') {
  if (!Array.isArray(list) || !changes) return Array.isArray(list) ? list : [];
  return list.map(function (item) {
    return item && item[key] === changes[key] ? Object.assign({}, item, changes) : item;
  });
}

export function rowAt(index, list) {
  return Array.isArray(list) && list[index] ? list[index] : null;
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1048576).toFixed(2)} MB`;
}

export function createSearchActions(loadList, wait = 250) {
  const searchList = () => { loadList(1); };
  return { searchList, debouncedSearch: debounce(searchList, wait) };
}

export function createApiPrefixedRequest(request, prefix) {
  const base = String(prefix ?? getContracts().http.apiPrefix);
  return (options = {}) => request.post(base + String(options.url || ''), options.data)
    .catch((error) => failureResult(error?.message));
}

export function raceTimeout(promise, wait, fallback) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((resolve) => setTimeout(() => resolve(fallback), wait))
  ]);
}

export function debounce(fn, wait = 200) {
  if (typeof fn !== 'function') return fn;
  let timer = 0;
  const debounced = function (...args) {
    const context = this;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = 0;
      fn.apply(context, args);
    }, wait);
  };
  debounced.cancel = function () {
    if (timer) { clearTimeout(timer); timer = 0; }
  };
  return debounced;
}

export function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function createLruCache(limit = 200) {
  const max = Math.max(1, Math.floor(Number(limit) || 200));
  const store = new Map();
  const api = {
    get size() { return store.size; },
    has(key) { return store.has(key); },
    get(key) {
      if (!store.has(key)) return undefined;
      const value = store.get(key);
      store.delete(key);
      store.set(key, value);
      return value;
    },
    set(key, value) {
      if (store.has(key)) store.delete(key);
      store.set(key, value);
      while (store.size > max) store.delete(store.keys().next().value);
      return api;
    },
    delete(key) { return store.delete(key); },
    clear() { store.clear(); },
    keys() { return store.keys(); },
    values() { return store.values(); },
    entries() { return store.entries(); },
    forEach(callback, thisArg) { store.forEach(callback, thisArg); },
    [Symbol.iterator]() { return store[Symbol.iterator](); }
  };
  return api;
}

const ANCHOR_LINK_SELECTOR = 'a[href^="#"]';
const ROUTE_HASH_PREFIX = '#/';
const FIXED_OFFSET_VAR = '--kniu-fixed-offset';
const FIXED_OFFSET_STYLE_ID = 'kniu-fixed-offset-style';
const fixedOffsetValues = new WeakMap();
let fixedOffsetInitialized = false;

export function publishFixedOffset(doc, value) {
  const target = doc || globalThis.document;
  const next = String(value || '').trim();
  if (!target || !next) return;
  if (fixedOffsetValues.get(target) !== next) {
    const applied = adoptDocumentStyle(FIXED_OFFSET_STYLE_ID, `:root{${FIXED_OFFSET_VAR}:${next};}`, target);
    if (!applied) return;
    fixedOffsetValues.set(target, next);
  }
  const root = target.documentElement;
  if (root?.style?.getPropertyValue(FIXED_OFFSET_VAR)) {
    root.style.removeProperty(FIXED_OFFSET_VAR);
    if (!root.getAttribute('style')) root.removeAttribute('style');
  }
}

globalThis.addEventListener?.('DOMContentLoaded', function bootstrapFixedOffset() {
  globalThis.removeEventListener?.('DOMContentLoaded', bootstrapFixedOffset);
  ensureFixedOffsetObserver();
});

const SCROLL_LOCK_STYLE_ID = 'kniu-scroll-lock-style';
const SCROLL_LOCK_CSS = [
  'html[data-kniu-scroll-lock="1"],html[data-kniu-scroll-lock="1"] body{',
  'overflow:hidden!important;overflow-x:hidden!important;overflow-y:hidden!important;}',
  '[data-kniu-mount-lock="hidden"]{overflow-y:hidden!important;}',
  '[data-kniu-mount-lock="scroll"]{overflow-y:scroll!important;}'
].join('');
const scrollLockInstalled = new WeakSet();

export function installScrollLockStyles(root) {
  const target = root || globalThis.document;
  if (!target || scrollLockInstalled.has(target)) return null;
  const applied = adoptDocumentStyle(SCROLL_LOCK_STYLE_ID, SCROLL_LOCK_CSS, target);
  if (applied) scrollLockInstalled.add(target);
  return applied;
}

export function setOverflowLock(el, value) {
  if (!el || typeof el.setAttribute !== 'function') return false;
  installScrollLockStyles(el.getRootNode?.() || globalThis.document);
  if (value) {
    el.setAttribute('data-kniu-mount-lock', value === 'scroll' ? 'scroll' : 'hidden');
    return true;
  }
  el.removeAttribute('data-kniu-mount-lock');
  return false;
}

export function handleAnchorClick(event) {
  const link = event?.target?.closest?.(ANCHOR_LINK_SELECTOR);
  if (!link) return;
  const href = link.getAttribute('href') || '';
  if (href.indexOf(ROUTE_HASH_PREFIX) === 0) return;
  const targetId = decodeAnchorId(href.slice(1));
  if (!targetId) return;
  const target = findAnchorTarget(event.currentTarget, targetId);
  if (!target) return;
  event.preventDefault();
  ensureFixedOffsetObserver();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function ensureFixedOffsetObserver() {
  if (fixedOffsetInitialized) return;
  fixedOffsetInitialized = true;
  const doc = globalThis.document;
  if (!doc || typeof ResizeObserver === 'undefined') { syncFixedOffset(doc); return; }
  const sync = function () { syncFixedOffset(doc); };
  const tryObserve = function () {
    const head = doc.querySelector('.kniu_web_head, kniu-navbar');
    if (!head) { globalThis.setTimeout(tryObserve, 250); return; }
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(head);
    if (doc.body) ro.observe(doc.body);
    globalThis.addEventListener('resize', sync, { passive: true });
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', tryObserve);
  else tryObserve();
}

function syncFixedOffset(doc) {
  const offset = measureTopCover(doc) || readHeadHeight(doc);
  if (offset <= 0) return;
  publishFixedOffset(doc, `${offset}px`);
}

function measureTopCover(doc) {
  const view = doc?.defaultView;
  if (!view || typeof doc.elementsFromPoint !== 'function') return 0;
  const centerX = Math.round(view.innerWidth / 2);
  const elements = doc.elementsFromPoint(centerX, 1) || [];
  let maxBottom = 0;
  const visited = [];
  for (let i = 0; i < elements.length; i += 1) {
    maxBottom = Math.max(maxBottom, collectFixedBottom(elements[i], view, visited));
  }
  return maxBottom;
}

function readHeadHeight(doc) {
  const head = doc.querySelector('.kniu_web_head, header, kniu-navbar');
  if (!head) return 0;
  const rect = head.getBoundingClientRect();
  return Math.round(rect.height) || 0;
}

function collectFixedBottom(element, view, visited) {
  let bottom = 0;
  let node = element;
  while (node && node.nodeType === 1) {
    if (visited.indexOf(node) !== -1) { node = null; break; }
    visited.push(node);
    const style = view.getComputedStyle(node);
    if (style.position === 'fixed' || style.position === 'sticky') {
      const rect = node.getBoundingClientRect();
      if (rect.top <= 1 && rect.height > 0) bottom = Math.max(bottom, Math.round(rect.bottom));
    }
    const root = node.getRootNode?.();
    node = node.parentElement || root?.host || null;
  }
  return bottom;
}

function decodeAnchorId(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function findAnchorTarget(container, targetId) {
  const scopeRoot = container?.getRootNode?.();
  if (scopeRoot && typeof scopeRoot.getElementById === 'function') return scopeRoot.getElementById(targetId);
  return globalThis.document?.getElementById(targetId) || null;
}

const TRANSIENT_HTTP_STATUS = [502, 503, 504];

export function toPositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

export function isTransientHttpError(error) {
  const status = Number(error?.status || 0);
  return status === 0 || TRANSIENT_HTTP_STATUS.indexOf(status) > -1;
}