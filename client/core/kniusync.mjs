// 数据自动同步中心。
//
// 目标：任一端（后台或前台）写库后，所有在线页面自动看到最新数据——
// 页面不刷新、业务控制器也不写任何"改完再拉一次"的刷新代码。
//
// 链路：
//   PHP Core\Db 写操作 → Core\DataSignal（请求结束汇总 bump revision + 广播）
//   → Node /__notify → SSE 事件 data-change → 本模块 → 重放所有已注册数据源。
//
// 使用方式（框架已内置，业务一般无需关心）：
//   控制器 setup 内 autoSync(loadList) —— 把"重新拉数据"的函数注册为数据源；
//   组件销毁由 kniumvvm 的 dispose → disposeOwner() 自动注销，不会泄漏。
//   usePagination() 内部已自动注册，后台/前台所有分页列表零改动即具备该能力。
//
// 安全边界：SSE 只推"数据变了"+ 版本号，不含任何业务或用户数据；
// 真实数据一律由数据源自己走带鉴权的 /api 接口重拉，鉴权仍完全在 PHP。

import NOTIFY from './kniunotify.mjs';

/** 连续信号合并窗口：一个请求内的多次写只触发一次重放。 */
const THROTTLE_MS = 400;

/** owner（MVVM 控制器实例）→ 该作用域注册的数据源集合。 */
const ownerSources = new Map();

/** 不在控制器作用域内注册的数据源（调用方须自行 dispose）。 */
const orphanSources = new Set();

/** 控制器 setup() 执行期间的当前 owner，由 kniumvvm 维护。 */
let activeOwner = null;

/** 已知的最新数据版本号（来自 SSE 或兜底接口）。 */
let revision = 0;

/** 页面处于后台时收到过信号，回到前台需要补刷。 */
let dirty = false;

let throttleTimer = 0;
let unsubscribe = null;
let visibilityInstalled = false;

/**
 * 设置当前控制器作用域（由 kniumvvm 在 setup() 前后调用）。
 * @param {object|null} owner
 */
export function setActiveOwner(owner) {
  activeOwner = owner || null;
}

/**
 * 注册一个数据源；服务端数据变更时自动重放。
 *
 * 在控制器 setup() 内调用时自动绑定到当前作用域、随组件销毁而注销。
 *
 * @param {Function} reload 重新拉取并写回响应式 state 的函数（无必填入参）。
 * @return {Function} 手动注销函数。
 */
export function autoSync(reload) {
  if (typeof reload !== 'function') return function noop() { };
  const entry = { reload: reload };
  const owner = activeOwner;
  let bucket = orphanSources;
  if (owner) {
    bucket = ownerSources.get(owner);
    if (!bucket) {
      bucket = new Set();
      ownerSources.set(owner, bucket);
    }
  }
  bucket.add(entry);
  ensureSubscribed();
  return function dispose() {
    bucket.delete(entry);
  };
}

/**
 * 注销某个作用域的全部数据源（由 kniumvvm dispose() 调用）。
 * @param {object} owner
 */
export function disposeOwner(owner) {
  if (owner) ownerSources.delete(owner);
}

/** 收集当前仍存活的数据源。 */
function collectEntries() {
  const entries = [];
  ownerSources.forEach(function (bucket, owner) {
    // 兜底清理：控制器实例已停止但未被显式注销时顺手移除，避免 Map 长期增长。
    if (owner && owner.stopped) {
      ownerSources.delete(owner);
      return;
    }
    bucket.forEach(function (entry) { entries.push(entry); });
  });
  orphanSources.forEach(function (entry) { entries.push(entry); });
  return entries;
}

/** 立即重放所有数据源。 */
export function refreshAll(reason) {
  // 后台标签不刷：省流量与请求，标记为待补刷，等页面重新可见时再拉。
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    dirty = true;
    return 0;
  }
  const entries = collectEntries();
  for (let i = 0; i < entries.length; i++) {
    try {
      entries[i].reload(reason);
    } catch (error) {
      console.warn('[SYNC] 数据源重放失败:', error);
    }
  }
  return entries.length;
}

/** 节流重放：合并短时内的连续变更信号。 */
export function scheduleRefresh(reason) {
  if (throttleTimer) clearTimeout(throttleTimer);
  throttleTimer = setTimeout(function () {
    throttleTimer = 0;
    refreshAll(reason);
  }, THROTTLE_MS);
}

/**
 * 页面重新可见时的补刷：后台期间收到 SSE 信号则直接刷新。
 * 不再请求 data_revision，避免轮询式版本检查带来的额外开销。
 */
function handleVisible() {
  const wasDirty = dirty;
  dirty = false;
  if (wasDirty) {
    refreshAll('visible');
  }
}

function installVisibilityFallback() {
  if (visibilityInstalled || typeof document === 'undefined') return;
  visibilityInstalled = true;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') handleVisible();
  });
  if (typeof globalThis !== 'undefined' && globalThis.addEventListener) {
    globalThis.addEventListener('focus', function () {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') handleVisible();
    });
  }
}

/** 首次有数据源注册时才建立 SSE 订阅，无订阅不空挂连接。 */
function ensureSubscribed() {
  if (unsubscribe || typeof window === 'undefined') return;
  unsubscribe = NOTIFY.subscribeDataChange(function (payload) {
    const next = Number(payload && payload.revision) || 0;
    // 同一版本重复广播（多写操作合并/重连补发）直接忽略。
    if (next > 0 && next === revision) return;
    if (next > 0) revision = next;
    scheduleRefresh('sse');
  });
  installVisibilityFallback();
}

export default {
  autoSync,
  setActiveOwner,
  disposeOwner,
  scheduleRefresh,
  refreshAll
};
