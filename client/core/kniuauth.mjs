import KniuTemplate from './kniutemplate.mjs';
import REQUEST from './kniurequest.mjs';

const { reactive } = KniuTemplate;

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
        try {
          sessionStorage.removeItem('kniu_authed');
          sessionStorage.removeItem('kniu_user');
        } catch (e) { }
        notify();
      }
    });
  }

  /** 应用启动期向服务端校验持久会话，并恢复当前登录用户。 */
  async function restoreSession() {
    try {
      await REQUEST({
        url: '/system',
        type: 'POST',
        redirectOnUnauthorized: false,
        success(res) {
          if (res.status !== 1) {
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
   * 会话失效复位：由请求层在收到后端 401 时调用，同步重置前端登录态，
   * 使路由守卫立即生效（与后端销毁会话保持一致）。
   */
  function markLoggedOut() {
    state.loggedIn = false;
    state.user = null;
    try {
      sessionStorage.removeItem('kniu_authed');
      sessionStorage.removeItem('kniu_user');
    } catch (e) { }
    notify();
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
