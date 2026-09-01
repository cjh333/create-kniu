import { throttle } from './kniuutil.mjs';

const PLACEHOLDER_CLASS = 'kniu_web_head_placeholder';
const HEAD_SELECTOR = '.kniu_web_head';
const headObservers = new WeakMap();
// 已发现的头部元素登记表。避免每次 DOM 变更都全树深度遍历（表格批量渲染时会被放大成 O(节点数) 热点）。
const knownHeads = new Set();

// 在给定子树内登记头部元素（穿透 Shadow DOM）。
// 注意：nodeType !== 1 的节点（document / DocumentFragment / ShadowRoot）也有 children，
// 不能提前 return，否则跨 Shadow DOM 后什么都查不到。
function collectHeads(node) {
  if (!node) return;
  if (node.nodeType === 1 && typeof node.matches === 'function' && node.matches(HEAD_SELECTOR)) {
    knownHeads.add(node);
  }
  if (node.shadowRoot) collectHeads(node.shadowRoot);
  const kids = node.children;
  if (!kids) return;
  for (let i = 0; i < kids.length; i += 1) collectHeads(kids[i]);
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

// deep=true 时重新全树扫描登记（仅在初始化 / 路由切换等结构性变化后需要）；
// deep=false 只同步已登记的头部，成本与头部数量成正比，与页面节点数无关。
export function syncHeadPlaceholder(deep = true) {
  try {
    if (deep) collectHeads(document);
    knownHeads.forEach(function (head) {
      // 元素可能随路由切换被移除，及时从登记表剔除，避免无限增长
      if (!head.isConnected) {
        knownHeads.delete(head);
        return;
      }
      syncOneHead(head);
    });
  } catch (e) {
    console.warn('[headfix] 同步头部占位失败：', e);
  }
}

// 同一帧内的多次变更合并为一次同步，避免「改一个节点就扫一遍全树」。
let syncFrame = 0;
let pendingDeep = false;
function scheduleSync(deep) {
  if (deep) pendingDeep = true;
  if (syncFrame) return;
  syncFrame = requestAnimationFrame(function () {
    syncFrame = 0;
    const useDeep = pendingDeep;
    pendingDeep = false;
    syncHeadPlaceholder(useDeep);
  });
}

function scheduleInitialSync() {
  syncHeadPlaceholder(true);
  scheduleSync(true);
  // 首屏字体/样式异步到位后头部高度会变，补两次延迟校正
  setTimeout(function () { syncHeadPlaceholder(false); }, 60);
  setTimeout(function () { syncHeadPlaceholder(false); }, 300);
}

export function initHeadFixed() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  scheduleInitialSync();
  window.addEventListener('load', scheduleInitialSync);
  const onResize = throttle(function () { scheduleSync(true); }, 120);
  window.addEventListener('resize', onResize);

  window.addEventListener('hashchange', function () { scheduleSync(true); });
  window.addEventListener('popstate', function () { scheduleSync(true); });
  const host = document.querySelector('#app') || document.body;
  if (host && typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver(function (records) {
      // 只扫描新增节点子树（浅层），主线程成本与「本次新增量」成正比，而非整页节点数
      let touched = false;
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (typeof node.matches === 'function' && node.matches(HEAD_SELECTOR)) knownHeads.add(node);
          if (node.querySelector && node.querySelector(HEAD_SELECTOR)) collectHeads(node);
          touched = true;
        });
      });
      scheduleSync(!touched);
    });
    mo.observe(host, { childList: true, subtree: true });
  }
}
