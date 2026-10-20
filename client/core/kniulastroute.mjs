export const STORAGE_KEY = 'KNIU_SYSTEM_LAST_ROUTE';
let JUMP_ROUTES = [];

/**
 * 配置「鉴权中转页」清单：这些页面不计入「上一次页面」记忆，避免登录/注册/找回
 * 等流程污染返回来源。核心库保持项目无关，具体路由由使用方在启动时经本函数注入
 * （本项目由 client.mjs 从请求层 REDIRECT 的 route 派生后传入）。
 * @param {Array<string>} routes 路由路径数组，如 ['/login', '/register', '/forgot']。
 */
export function setAuthRoutes(routes) {
  JUMP_ROUTES = Array.isArray(routes)
    ? routes
      .map(function (r) { return String(r == null ? '' : r).trim(); })
      .filter(function (r) { return r !== ''; })
    : [];
}

/**
 * 读取当前配置的鉴权中转页清单（副本），供调试/自检。
 * @returns {Array<string>}
 */
export function getAuthRoutes() {
  return JUMP_ROUTES.slice();
}

/**
 * 归一化路由记录：剥离 hash 前缀与查询串；鉴权页与非对象输入返回 null。
 * @param {Object} route { path, data } 形态的路由记录。
 * @returns {Object|null} { path, data } 或 null。
 */
function normalizeRoute(route) {
  if (!route || typeof route !== 'object') return null;
  const path = String(route.path || '').replace(/^#/, '').split('?')[0].split('#')[0] || '/';
  if (JUMP_ROUTES.indexOf(path) >= 0) return null;
  const data = route.data && typeof route.data === 'object' ? route.data : null;
  return { path: path, data: data };
}

/**
 * 记录「上一次页面」。鉴权页与非法输入被忽略（返回 null）。
 * @param {Object} route 上一次页面的 { path, data }。
 * @returns {Object|null} 实际入库的记录（被过滤则为 null）。
 */
export function rememberLastRoute(route) {
  const normalized = normalizeRoute(route);
  if (!normalized) return null;
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) { }
  return normalized;
}

/**
 * 读取「上一次页面」。
 * @returns {Object|null} { path, data }；无记录、存储异常或内容被过滤时返回 null。
 */
export function getLastRoute() {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeRoute(JSON.parse(raw));
  } catch (e) {
    return null;
  }
}