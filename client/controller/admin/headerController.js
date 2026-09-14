import MVVM from '../../core/kniumvvm.mjs';
import { getCurrentRoutePath } from '../../core/kniuutil.mjs';
import AUTH from '../../core/kniuauth.mjs';
import REQUEST from '../../core/kniurequest.mjs';
import NOTIFY from '../../core/kniunotify.mjs';

const { controller, onMounted, reactive } = MVVM;

let replyNotificationRequest = null;
let replyNotificationCompletedAt = 0;
const REPLY_NOTIFICATION_DEDUPE_MS = 3000;

function requestReplyNotificationState() {
  const now = Date.now();
  if (replyNotificationRequest) return replyNotificationRequest;
  if (now - replyNotificationCompletedAt < REPLY_NOTIFICATION_DEDUPE_MS) {
    return Promise.resolve(null);
  }
  replyNotificationRequest = REQUEST({
    url: '/comment_reply_state',
    type: 'POST',
    data: {},
    redirectOnUnauthorized: false
  }).finally(function () {
    replyNotificationRequest = null;
    // 从请求完成后开始计时，慢请求不能让去重窗口提前失效。
    replyNotificationCompletedAt = Date.now();
  });
  return replyNotificationRequest;
}

function getAdminPageName(path) {
  if (path === '/seo') return '网站信息';
  if (path === '/aboutedit') return '关于我';
  if (path === '/dailydetail') return '每日一句';
  if (path === '/articledetail') return '文章管理';
  if (path === '/users') return '用户管理';
  if (path === '/comment') return '评论管理';
  if (path === '/reply') return '回复管理';
  return '控制台';
}

const headerController = controller(({ navigateTo, onRouteChange }) => {
  const initialPath = getCurrentRoutePath();
  const state = reactive({
    brandMark: 'K',
    workspaceLabel: '工作台',
    currentPath: initialPath,
    currentApp: { name: getAdminPageName(initialPath) },
    showWebsiteInfo: false,
    showDaily: false,
    showUserManagement: false,
    hasUnreadReply: false,
    unreadReplyCount: 0,
    notificationBadge: { isDot: false }
  });

  function updateCurrentApplication(path) {
    state.currentPath = path;
    state.currentApp = { name: getAdminPageName(path) };
  }

  function updateUserNavigation(user) {
    state.showWebsiteInfo = Number(user?.roleId || user?.role || 0) === 1 || Number(user?.roleAuth || 0) === 1;
    state.showDaily = state.showWebsiteInfo;
    state.showUserManagement = !!String(user?.name || '').trim();
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
    const result = await requestReplyNotificationState();
    if (!result) return;
    if (result.status !== 1) return;
    syncNotificationBadge(result.data?.has_unread, result.data?.unread_count);
  }

  async function handleNotificationRequest() {
    if (state.hasUnreadReply) {
      const result = await REQUEST({
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

  onMounted(function () {
    updateUserNavigation(AUTH.getUser());
    loadReplyNotification();
    // 仅由真实回复刷新信号更新红点，不使用可见性或定时轮询产生无条件请求。
    const stopNotify = NOTIFY.subscribeReplyRefresh(loadReplyNotification);
    globalThis.addEventListener('kniu:reply-notification-change', loadReplyNotification);
    const stopRoute = onRouteChange(updateCurrentApplication);
    const stopAuth = AUTH.subscribe(function (authState) {
      updateUserNavigation(authState.user);
      if (!authState.authenticated) syncNotificationBadge(false, 0);
    });
    return function () {
      stopNotify();
      globalThis.removeEventListener('kniu:reply-notification-change', loadReplyNotification);
      stopRoute();
      stopAuth();
    };
  });

  return {
    state,
    handleNavigation,
    handleHomeNavigation,
    handleNotificationRequest,
    handleRefresh
  };
});
export default headerController;
