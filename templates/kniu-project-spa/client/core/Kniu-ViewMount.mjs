import { evaluateTemplateExpression } from './Kniu-TemplateEngine.mjs';
import { loadComponents } from './Kniu-ComponentLoader.mjs';
import { ensureShadowRoot, syncGlobalStyles, resolveCssImports } from './Kniu-Shadow.mjs';
import { kniuWarn, KNDEBUG } from './Kniu-Debug.mjs';
import { setOverflowLock } from './Kniu-Util.mjs';

export const pruneEmptyStyle = (el) => {
  if (!el?.style) return;
  if (el.style.cssText.trim()) return;
  if (el.hasAttribute('style')) el.removeAttribute('style');
};

export const pruneEmptyClass = (el) => {
  if (!el?.hasAttribute?.('class')) return;
  if (!String(el.getAttribute('class') || '').trim()) el.removeAttribute('class');
};

export const pruneEmptyAttributes = (el) => {
  pruneEmptyStyle(el);
  pruneEmptyClass(el);
};

export const removeClass = (el, ...names) => {
  if (!el?.classList) return;
  el.classList.remove(...names);
  pruneEmptyClass(el);
};

const STYLE_BLOCK_RE = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi;

export async function expandStyleImports(html, baseUrl = globalThis.document?.baseURI || globalThis.location?.href || '') {
  const source = String(html || '');
  const blocks = [...source.matchAll(STYLE_BLOCK_RE)];
  if (!blocks.length) return source;
  let output = '';
  let cursor = 0;
  for (const match of blocks) {
    if (!/@import/i.test(match[2])) continue;
    output += source.slice(cursor, match.index);
    let css = match[2];
    try { css = await resolveCssImports(match[2], baseUrl); }
    catch (error) { kniuWarn(KNDEBUG.VIEW, '[kniu-view] 样式 @import 展开失败，保留原语句：', error); }
    output += match[1] + css + match[3];
    cursor = match.index + match[0].length;
  }
  return output + source.slice(cursor);
}

const BUILTIN_SLOTS = {
  'kniu-input': ['prepend', 'append'],
  'kniu-date-picker': ['prepend', 'append'],
  'kniu-editor': ['prepend', 'append'],
  'kniu-modal': ['header', 'default', 'footer'],
  'kniu-user-login': ['default'],
  'kniu-table': ['empty'],
  'kniu-sub-navbar': ['title'],
  'kniu-navbar': ['brand', 'append', 'default']
};

export function convertSlotTemplates(host) {
  const acceptedSlotName = (tag, slotName) => {
    const declared = customElements.get(tag)?.slots;
    if (declared) return declared.has(slotName);
    return (BUILTIN_SLOTS[tag] || []).includes(slotName);
  };
  const shouldFlattenSlotTemplate = (template) => {
    const parent = template.parentElement;
    if (!parent) return false;
    const slotAttr = [...template.attributes].find((attribute) => attribute.name.charCodeAt(0) === 35);
    if (!slotAttr) return false;
    const slotName = slotAttr.name.slice(1);
    if (!acceptedSlotName(parent.localName, slotName)) return false;
    const declared = customElements.get(parent.localName)?.slots;
    if (declared && !declared.has('default') && !declared.has(slotName)) return false;
    return true;
  };
  for (let round = 0; round < 5; round += 1) {
    const pending = [...host.querySelectorAll('template')].filter(shouldFlattenSlotTemplate);
    if (!pending.length) return;
    pending.forEach((template) => {
      const slotAttr = [...template.attributes].find((attribute) => attribute.name.charCodeAt(0) === 35);
      const slotName = slotAttr.name.slice(1);
      const labelWidth = template.getAttribute('label-width') || template.getAttribute('labelwidth') || template.getAttribute('data-label-width') || '';
      const parent = template.parentNode;
      if (!parent) return;
      if (slotName === 'prepend' && labelWidth && parent.matches?.('kniu-input, kniu-date-picker, kniu-editor') && !parent.hasAttribute('label-width')) {
        parent.setAttribute('label-width', labelWidth);
      }
      [...template.content.childNodes].forEach((node) => {
        let importable = null;
        if (node.nodeType === Node.TEXT_NODE) {
          if (!node.textContent.trim()) return;
          importable = document.createElement('span');
          importable.setAttribute('slot', slotName);
          if (labelWidth) importable.dataset.labelWidth = labelWidth;
          importable.textContent = node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          importable = node;
          if (!node.hasAttribute('slot')) node.setAttribute('slot', slotName);
          if (labelWidth && !node.hasAttribute('data-label-width')) node.dataset.labelWidth = labelWidth;
        } else {
          return;
        }
        parent.insertBefore(importable, template);
      });
      template.remove();
    });
  }
}

export async function mountViewTree(scope, model, bind) {
  const bindQueue = [];
  await mountViewTreeInner(scope, model, bindQueue);
  await loadComponents(scope);
  if (typeof bind === 'function') bindQueue.forEach(([queuedModel, queuedScope]) => bind(queuedModel, queuedScope));
}

async function mountViewTreeInner(scope, model, bindQueue) {
  const hosts = [...scope.querySelectorAll('[data-kniu-view-host]')].filter((host) => !host.shadowRoot);
  for (const host of hosts) {
    const sr = ensureShadowRoot(host);
    while (host.firstChild) sr.appendChild(host.firstChild);
    await syncGlobalStyles(host);
    await mountViewTreeInner(sr, model, bindQueue);
  }
  convertSlotTemplates(scope);
  bindQueue.push([model, scope]);
}

export function collectRefs(scope, refsTarget, reset = true) {
  if (!refsTarget || typeof refsTarget !== 'object') return;
  if (reset) Object.keys(refsTarget).forEach((key) => { delete refsTarget[key]; });
  scope.querySelectorAll('[ref]').forEach((element) => {
    const name = element.getAttribute('ref');
    if (name) refsTarget[name] = element;
  });
  scope.querySelectorAll('[data-kniu-view-host]').forEach((host) => {
    if (host.shadowRoot) collectRefs(host.shadowRoot, refsTarget, false);
  });
}

export function recordIncludeSnapshots(scope) {
  scope.querySelectorAll?.('[data-kniu-view-host]')?.forEach?.((host) => {
    host.__kniuIncludeHtml = host.innerHTML;
  });
}

export function renderRawText(expr, model) {
  return String(evaluateTemplateExpression(expr, model) ?? '');
}

export function createMountHidden() {
  let mountHiddenDepth = 0;
  let mountHiddenLocks = [];
  let mountHiddenUnlockTimer = 0;
  const applyMountHiddenLock = (host) => {
    if (mountHiddenUnlockTimer) { clearTimeout(mountHiddenUnlockTimer); mountHiddenUnlockTimer = 0; }
    if (++mountHiddenDepth > 1) return;
    if (mountHiddenLocks.length) return;
    const rootEl = document.documentElement;
    const locks = [[rootEl, rootEl.clientWidth < window.innerWidth ? 'scroll' : 'hidden']];
    let node = host?.parentElement || null;
    while (node) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') {
        locks.push([node, node.scrollHeight > node.clientHeight ? 'scroll' : 'hidden']);
      }
      node = node.parentElement || node.getRootNode?.()?.host || null;
    }
    mountHiddenLocks = locks;
    for (const [el, lockValue] of locks) setOverflowLock(el, lockValue);
  };
  const releaseMountHiddenLock = () => {
    if (--mountHiddenDepth > 0) return;
    if (mountHiddenUnlockTimer) clearTimeout(mountHiddenUnlockTimer);
    mountHiddenUnlockTimer = setTimeout(() => {
      mountHiddenUnlockTimer = 0;
      const locks = mountHiddenLocks;
      mountHiddenLocks = [];
      for (const [el] of locks) {
        setOverflowLock(el, '');
        pruneEmptyAttributes(el);
      }
    }, 0);
  };
  return {
    async run(host, work) {
      host.classList.add('kniu-mount-hidden');
      applyMountHiddenLock(host);
      try { await work(); } finally {
        removeClass(host, 'kniu-mount-hidden');
        pruneEmptyAttributes(host);
        releaseMountHiddenLock();
      }
    },
    get depth() { return mountHiddenDepth; },
    dispose() {
      if (mountHiddenUnlockTimer) { clearTimeout(mountHiddenUnlockTimer); mountHiddenUnlockTimer = 0; }
      mountHiddenLocks = [];
      mountHiddenDepth = 0;
    }
  };
}

export const mountHiddenLimitKeys = Object.freeze(['containedMinVisible', 'containedSettle']);