import TEMPLATE from './kniutemplate.mjs';
import REQUEST from './kniurequest.mjs';
import IDENTITY from './kniuidentity.mjs';
import { resetAllStateStores } from './kniustore.mjs';

const { reactive } = TEMPLATE;

var KniuAuth = (function () {
  var state = reactive({
    loggedIn: false,
    user: null
  });

  var listeners = [];

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state); } catch (e) { }
    }
  }

  /**
   * 记录登录成功后的用户信息（由登录接口 / 工作台 user:update 调用）。
   * @param {Object} user 用户信息，如 { name, avatar, role }。
   */
  function setUser(user) {
    var previousRoleId = Number(state.user?.roleId || state.user?.id || 0);
    var nextRoleId = Number(user?.roleId || user?.id || 0);
    if (previousRoleId > 0 && nextRoleId > 0 && previousRoleId !== nextRoleId) {
      resetAllStateStores();
    }
    state.loggedIn = true;
    state.user = user;
    try {
      sessionStorage.setItem('kniu_authed', '1');
      sessionStorage.setItem('kniu_user', JSON.stringify(user));
    } catch (e) { }
    notify();
  }

  /**
   * 登录态判定。
   * @return {Boolean}
   */
  function isLoggedIn() {
    return state.loggedIn;
  }

  /**
   * 获取当前用户信息。
   * @return {Object|null}
   */
  function getUser() {
    return state.user;
  }

  /**
   * 退出登录：调用后端退出接口销毁会话，并重置本地状态。
   * @return {Promise}
   */
  function logout() {
    return REQUEST({
      url: '/logout',
      type: 'POST',
      complete() {
        state.loggedIn = false;
        state.user = null;
        resetAllStateStores();
        IDENTITY.clearIdentity();
        try {
          sessionStorage.removeItem('kniu_authed');
          sessionStorage.removeItem('kniu_user');
          localStorage.setItem('kniu_auth_logout_at', String(Date.now()));
        } catch (e) { }
        notify();
      }
    });
  }

  /** 应用启动期向服务端校验持久会话，并恢复当前登录用户。 */
  async function restoreSession() {
    try {
      await REQUEST({
        url: '/session_status',
        type: 'POST',
        mutation: false,
        redirectOnUnauthorized: false,
        success(res) {
          if (res.status !== 1 || !res.data?.loggedIn) {
            markLoggedOut();
            return;
          }
          var systemInfo = res.data || {};
          var userName = systemInfo.username || '';
          setUser({
            name: userName,
            avatar: userName ? userName.charAt(0) : '·',
            role: systemInfo.role || '管理员',
            roleId: Number(systemInfo.role_id || 0),
            roleAuth: Number(systemInfo.role_auth || 0)
          });
        },
        fail() { markLoggedOut(); }
      });
    } catch (e) { }
  }

  /**
   * 会话失效复位：由请求层在收到业务码 1001 / HTTP 401 时调用，仅重置前端登录态；
   * 跳转登录页由请求层统一执行（策略注入见 client/client.mjs）——鉴权只由服务端判定。
   */
  function markLoggedOut() {
    state.loggedIn = false;
    state.user = null;
    resetAllStateStores();
    try {
      sessionStorage.removeItem('kniu_authed');
      sessionStorage.removeItem('kniu_user');
    } catch (e) { }
    notify();
  }

  // 前台账号菜单退出时，通过 localStorage 事件让其它后台标签立即退出显示状态。
  if (typeof globalThis !== 'undefined' && typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('storage', function syncLogoutAcrossTabs(event) {
      if (event.key === 'kniu_auth_logout_at' && event.newValue) {
        markLoggedOut();
        if (typeof location !== 'undefined' && /^#\/(admin|home|seo|aboutedit|user|daily|article|comment|reply)/.test(location.hash)) {
          location.hash = '#/login';
        }
        return;
      }
      // 前台登录会更新统一身份；匿名身份是退出后的访客标记，不能触发恢复。
      if (event.key === 'kniu_front_identity' && event.newValue) {
        try {
          if (JSON.parse(event.newValue)?.nickname) restoreSession();
        } catch (e) { }
      }
    });
  }

  /**
   * 订阅状态变化。
   * @param {Function} cb 回调函数，接收最新 state。
   * @return {Function} 取消订阅函数。
   */
  function subscribe(cb) {
    if (typeof cb === 'function') listeners.push(cb);
    return function () {
      var idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  return {
    state: state,
    setUser: setUser,
    isLoggedIn: isLoggedIn,
    getUser: getUser,
    logout: logout,
    restoreSession: restoreSession,
    markLoggedOut: markLoggedOut,
    subscribe: subscribe
  };
}());

export default KniuAuth;
