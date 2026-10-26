function createAuth({ identity, storageKey = 'KNIU_AUTH' } = {}) {
  if (!identity) throw new TypeError('[kniu] createAuth requires an identity service.');
  let user = null;
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener({ loggedIn: Boolean(user), user }));
  const persist = () => { try { sessionStorage.setItem(storageKey, JSON.stringify(user)); } catch {} };
  const clear = () => { try { sessionStorage.removeItem(storageKey); } catch {} };
  return Object.freeze({
    get state() { return Object.freeze({ loggedIn: Boolean(user), user }); },
    isLoggedIn: () => Boolean(user),
    getUser: () => user,
    setUser(nextUser) { user = nextUser && typeof nextUser === 'object' ? { ...nextUser } : null; persist(); notify(); return user; },
    markLoggedOut() { user = null; clear(); notify(); },
    restore() {
      // 与 setUser 的校验口径一致：仅接受对象，防止存储被污染为非对象时产生伪登录态。
      try {
        const stored = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        user = stored && typeof stored === 'object' ? stored : null;
      } catch { user = null; }
      notify();
      return user;
    },
    logout() { this.markLoggedOut(); identity.clearIdentity(); },
    can(permission) { const permissions = user?.permissions || user?.permissionCodes || []; return Array.isArray(permissions) && permissions.includes(permission); },
    hasRole(role) { const roles = user?.roles || [user?.role].filter(Boolean); return Array.isArray(roles) && roles.includes(role); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  });
}

export { createAuth };
export default createAuth;
