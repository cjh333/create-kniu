import TEMPLATE from './kniutemplate/kniutemplate.mjs';
import REQUEST from './kniurequest.mjs';
import { notifyAuthExpired } from './kniurequest.mjs';
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

  function setUser(user) {
    var previousRoleId = Number(state.user?.roleId || state.user?.id || 0);
    var nextRoleId = Number(user?.roleId || user?.id || 0);
    if (previousRoleId > 0 && nextRoleId > 0 && previousRoleId !== nextRoleId) {
      resetAllStateStores();
    }
    state.loggedIn = true;
    state.user = user;
    try {
      sessionStorage.setItem('KNIU_SYSTEM_AUTHED', '1');
      sessionStorage.setItem('KNIU_SYSTEM_USER', JSON.stringify(user));
    } catch (e) { }
    notify();
  }

  function isLoggedIn() {
    return state.loggedIn;
  }

  function getUser() {
    return state.user;
  }

  function logout() {
    markLoggedOut();
    IDENTITY.clearIdentity();
    try {
      localStorage.setItem('KNIU_SYSTEM_AUTH_LOGOUT_TIME', String(Date.now()));
    } catch (e) { }
    return REQUEST({
      url: '/logout',
      type: 'POST',
      redirectOnUnauthorized: false,
      complete() { }
    });
  }

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

  async function syncFrontIdentity() {
    var before = IDENTITY.getIdentity();
    var result = null;
    try {
      result = await REQUEST({
        url: '/frontSessionSync',
        type: 'POST',
        mutation: false,
        data: { identity_token: before.token },
        redirectOnUnauthorized: false
      });
    } catch (e) {
      return IDENTITY.getIdentity();
    }
    var current = IDENTITY.getIdentity();
    if (current.token !== before.token || current.nickname !== before.nickname) return current;
    var data = result && result.status === 1 ? result.data : null;
    if (data && data.loggedIn && data.nickname) {
      var name = data.name || before.name;
      var avatar = data.avatar || '';
      if (before.nickname !== data.nickname || before.name !== name || before.avatar !== avatar || !before.account) {
        IDENTITY.setIdentity({ token: before.token, name: name, nickname: data.nickname, avatar: avatar, account: 1 });
      }
      return IDENTITY.getIdentity();
    }
    if (before.nickname) {
      IDENTITY.clearIdentity();
      try {
        localStorage.setItem('KNIU_SYSTEM_AUTH_LOGOUT_TIME', String(Date.now()));
      } catch (e) { }
    }
    return IDENTITY.getIdentity();
  }

  function markLoggedOut() {
    state.loggedIn = false;
    state.user = null;
    resetAllStateStores();
    try {
      sessionStorage.removeItem('KNIU_SYSTEM_AUTHED');
      sessionStorage.removeItem('KNIU_SYSTEM_USER');
    } catch (e) { }
    notify();
  }

  if (typeof globalThis !== 'undefined' && typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('storage', function syncLogoutAcrossTabs(event) {
      if (event.key === 'KNIU_SYSTEM_AUTH_LOGOUT_TIME' && event.newValue) {
        markLoggedOut();
        try {
          notifyAuthExpired();
        } catch (e) { }
        return;
      }
      if (event.key === 'KNIU_SYSTEM_FRONT_IDENTITY' && event.newValue) {
        try {
          if (JSON.parse(event.newValue)?.nickname) restoreSession();
        } catch (e) { }
      }
    });
  }

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
    syncFrontIdentity: syncFrontIdentity,
    markLoggedOut: markLoggedOut,
    subscribe: subscribe
  };
}());

export default KniuAuth;