/**
 * 顶部固定头部占位补偿
 * -------------------------------------------------------------
 * 前台 .kniu_web_head 现在使用 position:fixed 悬浮在视口顶部。
 * 由于 fixed 会脱离文档流，头部所在的自定义元素宿主高度塌缩为 0，
 * 导致同处一个 .kniu_web（flex 纵向容器）内的 .kniu_web_body 内容上移、
 * 被固定头部遮挡。
 *
 * 解决方式：当检测到 .kniu_web_head 计算样式为 fixed 时，在其所在的
 * ShadowRoot 内（作为 .kniu_web_head 的相邻兄弟节点，而非其子节点——
 * 子节点会因头部 fixed 一并脱离文档流而失效）注入一个等高的占位元素，
 * 使头部宿主重新维持原有高度，从而把 .kniu_web_body 向下撑开。
 *
 * 若头部将来改回非 fixed（例如某些断点），占位元素会被自动移除，
 * 由 .kniu_web_head 自身在正常流中占据高度，不会造成双重留白。
 */

const PLACEHOLDER_CLASS = 'kniu_web_head_placeholder';
const headObservers = new WeakMap();

/**
 * 跨 Shadow DOM 深度查询，返回匹配 selector 的所有元素。
 */
function deepQueryAll(selector, root) {
  const results = [];
  const walk = function (node) {
    // document / DocumentFragment 等非元素节点也要继续向下遍历，否则从 document 起步时整棵子树会被跳过。
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

/**
 * 同步单个头部的占位元素。
 */
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
      // 作为头部在 ShadowRoot 内的相邻兄弟插入（头部自身 fixed 脱离流，
      // 占位必须位于流中才能撑起宿主高度）。
      head.after(ph);
    }
    const h = head.offsetHeight;
    if (h > 0) ph.style.height = h + 'px';

    // 监听头部高度变化（响应式断点、导航换行、内容增减），实时同步占位高度。
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

/**
 * 扫描并同步页面中所有 .kniu_web_head 的占位元素。
 */
export function syncHeadPlaceholder() {
  try {
    const heads = deepQueryAll('.kniu_web_head');
    heads.forEach(syncOneHead);
  } catch (e) {
    console.warn('[headfix] 同步头部占位失败：', e);
  }
}

/**
 * 多时机调度：立即 + 下一帧 + 短延迟，覆盖首屏渲染与嵌套 Shadow 异步构建。
 */
function scheduleSync() {
  syncHeadPlaceholder();
  requestAnimationFrame(syncHeadPlaceholder);
  setTimeout(syncHeadPlaceholder, 60);
  setTimeout(syncHeadPlaceholder, 300);
}

/**
 * 初始化头部固定补偿：绑定首屏、路由切换、尺寸变化等触发时机。
 */
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

  // 页面视图切换：新页面元素挂到 #app（光层 childList 可见），
  // 触发后由 scheduleSync 的延迟调用等待其内部嵌套头部 Shadow 构建完成。
  const host = document.querySelector('#app') || document.body;
  if (host && typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver(function () {
      scheduleSync();
    });
    mo.observe(host, { childList: true, subtree: true });
  }
}
