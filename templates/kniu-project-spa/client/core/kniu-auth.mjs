function createAuth({ identity, storageKey = 'KNIU_AUTH', onLogout = null } = {}) {
  if (!identity) throw new TypeError('[kniu] createAuth requires an identity service.');
  let user = null;
  let version = 0;
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener({ loggedIn: Boolean(user), user }));
  const persist = () => { try { sessionStorage.setItem(storageKey, JSON.stringify(user)); } catch { } };
  const clear = () => { try { sessionStorage.removeItem(storageKey); } catch { } };
  return Object.freeze({
    get state() { return Object.freeze({ loggedIn: Boolean(user), user }); },
    get version() { return version; },
    isLoggedIn: () => Boolean(user),
    getUser: () => user,
    setUser(nextUser) { user = nextUser && typeof nextUser === 'object' ? { ...nextUser } : null; version++; persist(); notify(); return user; },
    markLoggedOut() { user = null; version++; clear(); notify(); },
    restore() {
      try {
        const stored = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        user = stored && typeof stored === 'object' ? stored : null;
      } catch { user = null; }
      version++;
      notify();
      return user;
    },
    async logout() {
      if (typeof onLogout === 'function') await onLogout();
      this.markLoggedOut();
      identity.clearIdentity();
    },
    can(permission) { const permissions = user?.permissions || user?.permissionCodes || []; return Array.isArray(permissions) && permissions.includes(permission); },
    hasRole(role) { const roles = user?.roles || [user?.role].filter(Boolean); return Array.isArray(roles) && roles.includes(role); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  });
}

export { createAuth };
export default createAuth;