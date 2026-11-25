import { createLruCache, escapeAttribute } from './Kniu-Util.mjs';
import { kniuError, KNDEBUG } from './Kniu-Debug.mjs';

const PROXY_STATE_GLOBAL = '__KNIU_PROXY_CONFIG__';

function getSharedState() {
  const g = globalThis;
  if (!g[PROXY_STATE_GLOBAL]) {
    g[PROXY_STATE_GLOBAL] = { domainWhitelist: [], urlRewrites: [] };
  }
  return g[PROXY_STATE_GLOBAL];
}

function isSameOrigin(url) {
  const base = globalThis.location;
  if (!base) return false;
  try {
    const u = new URL(url, base.href);
    return u.origin === base.origin;
  } catch (_) {
    return false;
  }
}

function isAllowed(url) {
  if (isSameOrigin(url)) return true;
  const { domainWhitelist } = getSharedState();
  if (domainWhitelist.length === 0) return true;
  try {
    const host = new URL(url).hostname;
    return domainWhitelist.includes(host);
  } catch (_) {
    return false;
  }
}

export function configureProxy(options = {}) {
  const state = getSharedState();
  if (Array.isArray(options.domainWhitelist)) state.domainWhitelist = [...options.domainWhitelist];
  if (Array.isArray(options.urlRewrites)) {
    state.urlRewrites = options.urlRewrites.reduce(function (compiled, rule) {
      if (!rule || typeof rule.pattern !== 'string' || typeof rule.replacement !== 'string') return compiled;
      try { compiled.push({ regex: new RegExp(rule.pattern, rule.flags || ''), replacement: rule.replacement }); }
      catch (error) {
        kniuError(KNDEBUG.RUNTIME, '[Kniu-Proxy] urlRewrite 规则编译失败已忽略：', {
          pattern: rule.pattern, flags: rule.flags, reason: error && error.message ? error.message : String(error)
        });
      }
      return compiled;
    }, []);
  }
  return { domainWhitelist: [...state.domainWhitelist], urlRewrites: state.urlRewrites.map((r) => ({ pattern: r.regex.source, flags: r.regex.flags, replacement: r.replacement })) };
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function fetchAsDataUrl(url) {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Only http/https URLs are supported');
  }
  if (!isAllowed(url)) {
    throw new Error('URL domain is not whitelisted for proxy');
  }
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error('Fetched resource is not an image');
  }
  const blob = await response.blob();
  return await blobToDataURL(blob);
}

export function canonicalizeImageUrl(url) {
  const { urlRewrites } = getSharedState();
  if (typeof url !== 'string' || !urlRewrites.length) return url;
  return urlRewrites.reduce(function (result, rule) {
    rule.regex.lastIndex = 0;
    return result.replace(rule.regex, rule.replacement);
  }, url);
}

const _cache = createLruCache(120);
const _inflight = new Map();

export function getImageDataUrl(url) {
  const target = canonicalizeImageUrl(url);
  if (_cache.has(target)) return Promise.resolve(_cache.get(target));
  if (_inflight.has(target)) return _inflight.get(target);
  const task = fetchAsDataUrl(target).then(
    (dataUrl) => { _cache.set(target, dataUrl); _inflight.delete(target); return dataUrl; },
    (error) => { _inflight.delete(target); throw error; }
  );
  _inflight.set(target, task);
  return task;
}

export const PROXY_MARK_ATTR = 'data-kniu-proxy-src';
export const PROXY_PENDING_ATTR = 'data-kniu-proxy-pending';
export const PROXY_FAIL_ATTR = 'data-kniu-proxy-failed';
export const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const IMG_TAG_RE = /<img\b([^>]*)>/gi;
const SRC_ATTR_RE = /(\ssrc\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

export function maskExternalImages(html) {
  if (typeof html !== 'string' || !/<img\b/i.test(html)) return html;
  return html.replace(IMG_TAG_RE, (full, attrs) => {
    if (attrs.indexOf(PROXY_MARK_ATTR) !== -1) return full;
    const match = SRC_ATTR_RE.exec(attrs);
    if (!match) return full;
    const url = String(match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (!/^https?:\/\//i.test(url) || isSameOrigin(url)) return full;
    const quote = match[2] !== undefined ? '"' : (match[3] !== undefined ? "'" : '"');
    const replacement = `${match[1]}${quote}${TRANSPARENT_PIXEL}${quote} ${PROXY_MARK_ATTR}="${escapeAttribute(url)}"`;
    return '<img' + attrs.replace(SRC_ATTR_RE, () => replacement) + '>';
  });
}

export function setImageSource(img, url) {
  if (!img) return false;
  const value = url == null ? '' : String(url);
  let isExternal = false;
  try {
    const u = new URL(value, globalThis.location?.href || 'http://localhost/');
    isExternal = /^https?:$/i.test(u.protocol) && u.origin !== globalThis.location?.origin;
  } catch (_) { }
  if (isExternal) {
    const token = String(img.dataset.kniuSrcToken = String(Number(img.dataset.kniuSrcToken || 0) + 1));
    img.removeAttribute(PROXY_FAIL_ATTR);
    img.src = TRANSPARENT_PIXEL;
    getImageDataUrl(value).then((dataUrl) => {
      if (img.dataset.kniuSrcToken !== token) return;
      img.src = dataUrl;
    }).catch(() => {
      if (img.dataset.kniuSrcToken !== token) return;
      img.setAttribute(PROXY_FAIL_ATTR, '1');
    });
    return true;
  }
  img.dataset.kniuSrcToken = String(Number(img.dataset.kniuSrcToken || 0) + 1);
  img.removeAttribute(PROXY_FAIL_ATTR);
  img.src = value;
  return false;
}

export function hydrateExternalImages(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return Promise.resolve(0);
  const scopes = [];
  (function collect(scope) {
    if (!scope || typeof scope.querySelectorAll !== 'function' || scopes.includes(scope)) return;
    scopes.push(scope);
    [].slice.call(scope.querySelectorAll('*')).forEach((el) => {
      if (el.shadowRoot) collect(el.shadowRoot);
    });
  })(root);
  const targets = [];
  scopes.forEach((scope) => {
    [].slice.call(scope.querySelectorAll(`img[${PROXY_MARK_ATTR}]`)).forEach((img) => {
      if (img.hasAttribute(PROXY_PENDING_ATTR)) return;
      img.setAttribute(PROXY_PENDING_ATTR, '1');
      targets.push(img);
    });
  });
  if (!targets.length) return Promise.resolve(0);
  return Promise.all(targets.map(async (img) => {
    const url = img.getAttribute(PROXY_MARK_ATTR);
    if (!url) return false;
    try {
      const dataUrl = await getImageDataUrl(url);
      img.removeAttribute(PROXY_MARK_ATTR);
      img.removeAttribute(PROXY_PENDING_ATTR);
      img.src = dataUrl;
      return true;
    } catch (_) {
      img.removeAttribute(PROXY_MARK_ATTR);
      img.removeAttribute(PROXY_PENDING_ATTR);
      img.setAttribute(PROXY_FAIL_ATTR, '1');
      return false;
    }
  })).then((results) => results.filter(Boolean).length);
}