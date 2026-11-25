import { createLruCache, raceTimeout } from './Kniu-Util.mjs';
import { DEFAULT_FONT_FAMILY } from './Kniu-Contracts.mjs';
import { loadCssText } from './Kniu-CssLoader.mjs';
import { kniuWarn, KNDEBUG } from './Kniu-Debug.mjs';

const shadowStyleSheets = createLruCache(200);
const supportsAdopted = (root) => typeof CSSStyleSheet === 'function' && typeof CSSStyleSheet.prototype.replaceSync === 'function' && !!root && 'adoptedStyleSheets' in root;

export function ensureShadowRoot(host) {
  if (!host) throw new Error('ensureShadowRoot: host is required');
  return host.shadowRoot || host.attachShadow({ mode: 'open' });
}

function* deepWalk(root) {
  const seen = new Set();
  const stack = [root];
  while (stack.length) {
    const scope = stack.pop();
    if (!scope || seen.has(scope)) continue;
    seen.add(scope);
    const nodes = scope.querySelectorAll ? scope.querySelectorAll('*') : [];
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      yield node;
      if (node.shadowRoot) stack.push(node.shadowRoot);
    }
  }
}

export function deepQuerySelectorAll(selector, root = globalThis.document) {
  const hits = [];
  for (const node of deepWalk(root)) {
    try { if (node.matches(selector)) hits.push(node); } catch { }
  }
  return hits;
}

export function deepQuerySelector(selector, root = globalThis.document) {
  for (const node of deepWalk(root)) {
    try { if (node.matches(selector)) return node; } catch { }
  }
  return null;
}

export function closestAcrossShadows(el, selector, root = globalThis.document) {
  let node = el;
  while (node && node.nodeType === 1) {
    try { if (node.matches(selector)) return node; } catch { return null; }
    if (node === root) return null;
    node = node.parentNode instanceof ShadowRoot ? node.parentNode.host : node.parentNode;
  }
  return null;
}

const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s\)]+))\s*\)?\s*([^;]*);/gi;
const CSS_URL_RE = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;

function rebaseCssUrls(cssText, baseUrl) {
  return String(cssText || '').replace(CSS_URL_RE, (full, quote, raw) => {
    const value = String(raw || '').trim();
    if (!value || /^(?:#|data:|blob:|about:)/i.test(value)) return full;
    try { return `url(${quote || '"'}${new URL(value, baseUrl).href}${quote || '"'})`; } catch { return full; }
  });
}

async function fetchCss(url) {
  return loadCssText(url);
}

const resolveCssCache = createLruCache(60);

export async function resolveCssImports(cssText, baseUrl = globalThis.location?.href || '', visited = new Set()) {
  const source = String(cssText || '');
  const cacheKey = `${baseUrl}\u0000${source}`;
  if (!visited.size && resolveCssCache.has(cacheKey)) return resolveCssCache.get(cacheKey);
  const result = await resolveCssImportsUncached(source, baseUrl, visited);
  if (!visited.size) resolveCssCache.set(cacheKey, result);
  return result;
}

async function resolveCssImportsUncached(source, baseUrl, visited) {
  const imports = [...source.matchAll(CSS_IMPORT_RE)];
  if (!imports.length) return rebaseCssUrls(source, baseUrl);
  let offset = 0;
  let output = '';
  for (const match of imports) {
    output += source.slice(offset, match.index);
    offset = match.index + match[0].length;
    let imported = '';
    try {
      const url = new URL(match[1] || match[2] || match[3] || '', baseUrl).href;
      if (!visited.has(url)) {
        visited.add(url);
        const result = await fetchCss(url);
        imported = await resolveCssImports(result.css, result.url, visited);
      }
    } catch (error) { kniuWarn(KNDEBUG.SHADOW, '[kniu-shadow] 样式加载失败：', error); }
    const media = String(match[4] || '').trim();
    output += imported && media ? `@media ${media}{${imported}}` : imported;
  }
  return rebaseCssUrls(output + source.slice(offset), baseUrl);
}

function stripCharset(cssText) {
  let out = String(cssText || '');
  out = out.replace(/^\uFEFF/, '');
  out = out.replace(/^\s*@charset\s+"[^"]*"\s*;\s*/i, '');
  return out;
}

function getSheet(cssText) {
  const raw = String(cssText || '');
  const css = stripCharset(raw);
  let sheet = shadowStyleSheets.get(css);
  if (!sheet) {
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
    } catch (error) {
      kniuWarn(KNDEBUG.SHADOW, '[kniu-shadow] CSSStyleSheet.replaceSync 失败，跳过。', error?.message || error);
      sheet = new CSSStyleSheet();
    }
    shadowStyleSheets.set(css, sheet);
  }
  return sheet;
}

async function adoptCss(root, cssText, baseUrl) {
  if (!cssText || !supportsAdopted(root)) return null;
  const sheet = getSheet(await resolveCssImports(cssText, baseUrl));
  if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  return sheet;
}

function headStyleSources(documentRef) {
  if (!documentRef?.head) return [];
  return [...documentRef.head.children].flatMap((element) => {
    if (element.matches?.('link[rel~="stylesheet"][href]')) {
      try {
        const css = element.sheet && [...element.sheet.cssRules].map((rule) => rule.cssText).join('\n');
        if (css) return [{ css, url: element.href }];
      } catch (_) { }
      return [{ css: '', url: element.href }];
    }
    if (element.matches?.('style')) return [{ css: element.textContent || '', url: documentRef.baseURI }];
    return [];
  });
}

const documentStyleCache = { key: '', pending: null };

function headStyleSignature(documentRef) {
  if (!documentRef?.head) return '';
  const parts = [];
  const children = documentRef.head.children;
  for (let index = 0; index < children.length; index += 1) {
    const element = children[index];
    if (element.matches?.('link[rel~="stylesheet"][href]')) parts.push(`l:${element.href}`);
    else if (element.matches?.('style')) parts.push(`s:${element.textContent || ''}`);
  }
  return parts.join('\u0001');
}

async function collectDocumentSheets(documentRef) {
  const sheets = [];
  const resetRules = new Set();
  for (const source of headStyleSources(documentRef)) {
    try {
      const value = source.css ? source : await fetchCss(source.url);
      const css = await resolveCssImports(value.css, value.url);
      if (css) {
        const sheet = getSheet(css);
        const rules = [...sheet.cssRules];
        const filtered = rules.filter((rule) => {
          if (!rule.selectorText || !rule.style) return true;
          const selector = rule.selectorText.replace(/::(before|after)/g, ':$1').replace(/\s/g, '').split(',').map((part) => /^:(before|after)$/.test(part) ? `*${part}` : part).sort().join(',');
          if (selector !== '*,*:after,*:before') return true;
          const noOutline = (rule.style.getPropertyValue('outline-style') === 'none' || rule.style.getPropertyValue('outline-width') === '0px')
            && ['outline-color', 'outline-style', 'outline-width'].every((name) => !rule.style.getPropertyPriority(name));
          const declarations = [...rule.style].filter((name) => !noOutline || !name.startsWith('outline-')).sort().map((name) => {
            const value = rule.style.getPropertyValue(name);
            return `${name}:${value}!${rule.style.getPropertyPriority(name)}`;
          }).join(';');
          const key = `${selector}{${declarations}${noOutline ? ';outline:none' : ''}}`;
          if (resetRules.has(key)) return false;
          resetRules.add(key);
          return true;
        });
        if (filtered.length) sheets.push(filtered.length === rules.length ? sheet : getSheet(filtered.map((rule) => rule.cssText).join('\n')));
      }
    } catch (error) { kniuWarn(KNDEBUG.SHADOW, '[kniu-shadow] 全局样式镜像失败：', error); }
  }
  return sheets;
}

const STYLE_ADOPT_TIMEOUT = 2500;

function documentSheets(documentRef) {
  const key = headStyleSignature(documentRef);
  if (documentStyleCache.key === key && documentStyleCache.pending) return documentStyleCache.pending;
  const pending = raceTimeout(collectDocumentSheets(documentRef), STYLE_ADOPT_TIMEOUT, null).then((sheets) => {
    if (sheets !== null) return sheets;
    documentStyleCache.key = '';
    documentStyleCache.pending = null;
    return [];
  }, (error) => {
    documentStyleCache.key = '';
    documentStyleCache.pending = null;
    kniuWarn(KNDEBUG.SHADOW, '[kniu-shadow] 文档样式解析失败：', error);
    return [];
  });
  documentStyleCache.key = key;
  documentStyleCache.pending = pending;
  return pending;
}

async function adoptDocumentStyles(root) {
  const documentRef = root.ownerDocument || globalThis.document;
  const sheets = await documentSheets(documentRef);
  if (sheets.length) root.adoptedStyleSheets = [...sheets, ...root.adoptedStyleSheets.filter((sheet) => !sheets.includes(sheet))];
}

async function normalizeShadowStyles(root) {
  const styles = [...root.querySelectorAll('style')].filter((style) => style.parentNode === root);
  for (const style of styles) {
    if (await adoptCss(root, style.textContent || '', root.ownerDocument?.baseURI || globalThis.location?.href)) style.remove();
  }
}

export async function syncGlobalStyles(host) {
  const root = ensureShadowRoot(host);
  if (!supportsAdopted(root)) return normalizeShadowStyles(root);
  await raceTimeout(adoptDocumentStyles(root), STYLE_ADOPT_TIMEOUT);
  await raceTimeout(normalizeShadowStyles(root), STYLE_ADOPT_TIMEOUT);
  const hostSheet = getSheet(`:host{font-family:var(--kniu-font-family,"${DEFAULT_FONT_FAMILY}")}[data-kniu-view-host],[data-kniu-route-view]{display:block}`);
  if (!root.adoptedStyleSheets.includes(hostSheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, hostSheet];
}

export default { ensureShadowRoot, resolveCssImports, syncGlobalStyles, deepQuerySelector, deepQuerySelectorAll, closestAcrossShadows };