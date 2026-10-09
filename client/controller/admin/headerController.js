import MVVM from '../../core/kniumvvm.mjs';
import { getCurrentRoutePath, getRouteContext } from '../../core/kniuutil.mjs';
import AUTH from '../../core/kniuauth.mjs';

const { controller } = MVVM;

let replyNotificationRequest = null;
let replyNotificationCompletedAt = 0;
const REPLY_NOTIFICATION_DEDUPE_MS = 3000;

function requestReplyNotificationState(request) {
  const now = Date.now();
  if (replyNotificationRequest) return replyNotificationRequest;
  if (now - replyNotificationCompletedAt < REPLY_NOTIFICATION_DEDUPE_MS) {
    return Promise.resolve(null);
  }
  replyNotificationRequest = request({
    url: '/comment_reply_state',
    type: 'POST',
    mutation: false,
    data: {},
    redirectOnUnauthorized: false
  }).finally(function () {
    replyNotificationRequest = null;
    replyNotificationCompletedAt = Date.now();
  });
  return replyNotificationRequest;
}

function getAdminPageName(path) {
  if (path === '/seo') return '网站信息';
  if (path === '/aboutedit') return '关于我';
  if (path === '/daily') return '每日一句';
  if (path === '/article') return '文章管理';
  if (path === '/user') return '用户管理';
  if (path === '/comment') return '评论管理';
  if (path === '/reply') return '回复管理';
  // 「数据库管理」是三层独立页面（库列表 → 数据表 → 单表），层级细节见 getAdminBreadcrumb()。
  if (path === '/database') return '数据库管理';
  if (path === '/databasetables') return '数据表';
  if (path === '/databasetable') return '表数据';
  return '控制台';
}

/**
 * 后台面包屑层级。
 *
 * 默认只有一段（栏目名）。「数据库管理」的三层是**真实路由页**，逐层下钻的层级信息
 * 统一挂到这条全局面包屑上（页内不再另画一条 crumb）：末段是当前位置（`name`），
 * 之前的每一段是**可点的上级**（`parents`，点它等同按「返回」回上一层）。
 *
 * 末段优先显示**上下文**（库名 / 表名）而不是泛泛的页面名 —— 三层页面的页面名
 * 已经由侧栏高亮的「数据库管理」表达，面包屑需要回答的是「我现在在哪个库/哪张表」。
 *
 * @param {string} path 当前路由路径。
 * @param {Object<string,string>} context `getRouteContext()` 取出的层级参数。
 * @return {{name: string, parents: Array<{label: string, route: string, data?: Object}>}} 面包屑。
 */
function getAdminBreadcrumb(path, context) {
  if (path === '/database') {
    return { name: '数据库管理', parents: [] };
  }
  // 「数据库连接」在层级上属于数据库管理的下一级（它是首次进入、库为空/连不上时的落地页），
  // 所以面包屑挂回「数据库管理」，而不是另起一个顶级入口。
  if (path === '/dbconnect') {
    return {
      name: '数据库连接',
      parents: [{ label: '数据库管理', route: '/database' }]
    };
  }
  if (path === '/databasetables') {
    return {
      name: context.database || '数据表',
      parents: [{ label: '数据库管理', route: '/database' }]
    };
  }
  if (path === '/databasetable') {
    const parents = [{ label: '数据库管理', route: '/database' }];
    if (context.database) {
      parents.push({ label: context.database, route: '/databasetables', data: { database: context.database } });
    }
    return { name: context.table || context.database || '表数据', parents };
  }
  return { name: getAdminPageName(path), parents: [] };
}

const headerController = controller(({ eventTo, getRouteData, navigateTo, onRouteChange, request, reactive, onMounted }) => {
  const initialPath = getCurrentRoutePath();
  const state = reactive({
    brandMark: 'K',
    workspaceLabel: '工作台',
    currentPath: initialPath,
    currentApp: getAdminBreadcrumb(initialPath, getRouteContext(getRouteData, ['database', 'table'])),
    showWebsiteInfo: false,
    showDaily: false,
    showUserManagement: false,
    showDatabaseAdmin: false,
    hasUnreadReply: false,
    unreadReplyCount: 0,
    notificationBadge: { isDot: false }
  });

  function updateCurrentApplication(path) {
    state.currentPath = path;
    state.currentApp = getAdminBreadcrumb(path, getRouteContext(getRouteData, ['database', 'table']));
  }

  /**
   * 点面包屑里的上级节点：回到上一层。
   *
   * 用**下标**回查 `state.currentApp.parents`，而不是把参数塞进 `data-*`：
   * 上级要带的路由数据（如 `{ database }`）是随层级变的，塞进属性等于把
   * 「下一层叫什么参数」的知识漏进视图里。
   *
   * @param {Object} event 点击事件（`currentTarget.dataset.index` 为层级下标）。
   * @return {void}
   */
  function handleCrumbNavigation(event) {
    const index = Number(event.currentTarget?.dataset?.index);
    const parent = (state.currentApp.parents || [])[index];
    if (!parent || !parent.route) return;
    navigateTo(parent.route, parent.data);
  }

  function updateUserNavigation(user) {
    state.showWebsiteInfo = Number(user?.roleId || user?.role || 0) === 1 || Number(user?.roleAuth || 0) === 1;
    state.showDaily = state.showWebsiteInfo;
    state.showUserManagement = !!String(user?.name || '').trim();
    state.showDatabaseAdmin = Number(user?.roleId || user?.role || 0) === 1;
  }

  function handleNavigation(event) {
    const path = event.currentTarget.dataset.nav;
    if (!path) return;
    updateCurrentApplication(path);
    navigateTo(path);
  }

  function handleHomeNavigation() {
    updateCurrentApplication('/admin');
    navigateTo('/admin');
  }

  function syncNotificationBadge(hasUnread, count = 0) {
    state.hasUnreadReply = !!hasUnread;
    state.unreadReplyCount = Math.max(0, Number(count) || 0);
    state.notificationBadge = { isDot: state.hasUnreadReply };
  }

  async function loadReplyNotification() {
    const result = await requestReplyNotificationState(request);
    if (!result) return;
    if (result.status !== 1) return;
    syncNotificationBadge(result.data?.has_unread, result.data?.unread_count);
  }

  async function handleNotificationRequest() {
    if (state.hasUnreadReply) {
      const result = await request({
        url: '/comment_reply_read',
        type: 'POST',
        data: {}
      });
      if (result.status === 1) syncNotificationBadge(false, 0);
    }
    updateCurrentApplication('/reply');
    navigateTo('/reply');
  }

  function handleRefresh() {
    location.reload();
  }

  function toFrontHome() {
    window.open('/', '_blank', 'noopener,noreferrer');
  }

  onMounted(function () {
    updateUserNavigation(AUTH.getUser());
    loadReplyNotification();
    const stopReplyNotification = eventTo?.on('reply:notification-change', loadReplyNotification);
    const stopRoute = onRouteChange(updateCurrentApplication);
    const stopAuth = AUTH.subscribe(function (authState) {
      updateUserNavigation(authState.user);
      if (!authState.authenticated) syncNotificationBadge(false, 0);
    });
    return function () {
      stopReplyNotification?.();
      stopRoute();
      stopAuth();
    };
  });

  return {
    state,
    handleNavigation,
    handleHomeNavigation,
    handleCrumbNavigation,
    handleNotificationRequest,
    handleRefresh,
    toFrontHome
  };
});
export default headerController;
