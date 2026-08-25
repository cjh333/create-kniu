const PLACEHOLDER_CLASS = 'kniu_web_head_placeholder';
const headObservers = new WeakMap();

function deepQueryAll(selector, root) {
  const results = [];
  const walk = function (node) {
    if (node && node.nodeType === 1) {
      const el = node;
      if (typeof el.matches === 'function' && el.matches(selector)) results.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
    const kids = node && node.children;
    if (kids) {
      for (let i = 0; i < kids.length; i++) walk(kids[i]);
    }
  };
  walk(root || document);
  return results;
}

function syncOneHead(head) {
  const root = head.getRootNode();
  if (!(root instanceof ShadowRoot)) return;
  const fixed = getComputedStyle(head).position === 'fixed';
  let ph = root.querySelector('.' + PLACEHOLDER_CLASS);
  if (fixed) {
    if (!ph) {
      ph = document.createElement('div');
      ph.className = PLACEHOLDER_CLASS;
      ph.setAttribute('aria-hidden', 'true');
      head.after(ph);
    }
    const h = head.offsetHeight;
    if (h > 0) ph.style.height = h + 'px';
    if (!headObservers.has(head)) {
      let raf = 0;
      const ro = new ResizeObserver(function () {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          const hh = head.offsetHeight;
          if (hh > 0 && ph && ph.isConnected) ph.style.height = hh + 'px';
        });
      });
      ro.observe(head);
      headObservers.set(head, ro);
    }
  } else if (ph) {
    const ro = headObservers.get(head);
    if (ro) {
      ro.disconnect();
      headObservers.delete(head);
    }
    ph.remove();
  }
}

export function syncHeadPlaceholder() {
  try {
    const heads = deepQueryAll('.kniu_web_head');
    heads.forEach(syncOneHead);
  } catch (e) {
    console.warn('[headfix] 同步头部占位失败：', e);
  }
}

function scheduleSync() {
  syncHeadPlaceholder();
  requestAnimationFrame(syncHeadPlaceholder);
  setTimeout(syncHeadPlaceholder, 60);
  setTimeout(syncHeadPlaceholder, 300);
}

export function initHeadFixed() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  scheduleSync();
  window.addEventListener('load', scheduleSync);
  let resizeTimer = 0;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scheduleSync, 120);
  });

  window.addEventListener('hashchange', scheduleSync);
  window.addEventListener('popstate', scheduleSync);
  const host = document.querySelector('#app') || document.body;
  if (host && typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver(function () {
      scheduleSync();
    });
    mo.observe(host, { childList: true, subtree: true });
  }
}