import MVVM from '../../core/kniumvvm.mjs';
import { getCurrentRoutePath, getRouteContext } from '../../core/kniuutil.mjs';
import { applyNavFlags } from './adminShared.js';
import AUTH from '../../core/kniuauth.mjs';

const { controller } = MVVM;

let replyNotificationRequest = null;
let replyNotificationCompletedAt = 0;
const REPLY_NOTIFICATION_DEDUPE_MS = 3000;

function requestReplyNotificationState(request) {
  if (!AUTH.isLoggedIn()) return Promise.resolve(null);
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
  const pathMap = {
    '/seo': '网站信息',
    '/aboutedit': '关于我',
    '/daily': '每日一句',
    '/article': '文章管理',
    '/user': '用户管理',
    '/comment': '评论管理',
    '/reply': '回复管理',
    '/feedback': '反馈管理',
    '/dbconnect': '数据库管理',
    '/database': '数据库列表',
    '/databasetables': '数据表',
    '/databasetable': '表数据'
  };
  return pathMap[path] || '控制台';
}

function getAdminBreadcrumb(path, context) {
  if (path === '/dbconnect') {
    return { name: '数据库管理', parents: [] };
  }
  if (path === '/database') {
    return {
      name: '数据库列表',
      parents: [{ label: '数据库管理', route: '/dbconnect' }]
    };
  }
  if (path === '/databasetables') {
    return {
      name: context.database || '数据表',
      parents: [{ label: '数据库管理', route: '/dbconnect' }]
    };
  }
  if (path === '/databasetable') {
    const parents = [{ label: '数据库管理', route: '/dbconnect' }];
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

  function handleCrumbNavigation(event) {
    const index = Number(event.currentTarget?.dataset?.index);
    const parent = (state.currentApp.parents || [])[index];
    if (!parent || !parent.route) return;
    navigateTo(parent.route, parent.data);
  }

  function updateUserNavigation(user) {
    applyNavFlags(state, user);
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
    if (!AUTH.isLoggedIn()) {
      syncNotificationBadge(false, 0);
      return;
    }
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
      if (!authState.loggedIn) syncNotificationBadge(false, 0);
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