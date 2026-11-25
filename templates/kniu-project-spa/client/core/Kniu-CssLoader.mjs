import { createLruCache } from './Kniu-Util.mjs';

const cssTextCache = createLruCache(100);
const CSS_FETCH_TIMEOUT = 2000;

function normalizeCssUrl(url) {
  const base = (globalThis.document && globalThis.document.baseURI)
    || globalThis.location?.href
    || '';
  return new URL(String(url), base).href;
}

async function requestCssText(key) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), CSS_FETCH_TIMEOUT) : null;
  try {
    const response = await fetch(key, {
      credentials: 'same-origin',
      signal: controller ? controller.signal : undefined
    });
    if (!response.ok) throw new Error(`CSS 请求失败：${response.status} ${key}`);
    return { css: await response.text(), url: response.url || key };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function loadCssText(url) {
  const key = normalizeCssUrl(url);
  if (!cssTextCache.has(key)) {
    cssTextCache.set(key, requestCssText(key).catch((error) => {
      cssTextCache.delete(key);
      throw error;
    }));
  }
  return cssTextCache.get(key);
}

export default loadCssText;