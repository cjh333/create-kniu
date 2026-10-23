export function createAuthSessionPlugin(options = {}) {
  return {
    name: 'auth-session',
    install(app) {
      const { auth, identity, request, config = {} } = options;
      if (!auth || !identity || !request) throw new TypeError('[kniu] auth-session requires auth, identity and request.');
      auth.restore();
      app.authReady = config.sessionUrl
        ? request.post(config.sessionUrl, { identityToken: identity.getIdentity().token }, { auth: false })
          .then((result) => {
            if (result?.data?.user) auth.setUser(result.data.user);
            else if (result?.user) auth.setUser(result.user);
            else auth.markLoggedOut();
          })
          .catch(() => { auth.markLoggedOut(); })
        : Promise.resolve();
      request.useResponseInterceptor(async (result) => {
        if (result.status === 401 || result.status === 403) {
          auth.markLoggedOut();
          identity.clearIdentity();
        }
        return result;
      });
      app.router?.beforeEach(async (context) => {
        await app.authReady;
        const meta = context.route.meta || {};
        const requiredPermissions = Array.isArray(meta.permissions) ? meta.permissions : meta.permission ? [meta.permission] : [];
        const requiredRoles = Array.isArray(meta.roles) ? meta.roles : meta.role ? [meta.role] : [];
        const rejected = (meta.requiresAuth && !auth.isLoggedIn()) || requiredPermissions.some((permission) => !auth.can(permission)) || requiredRoles.length && !requiredRoles.some((role) => auth.hasRole(role));
        if (!rejected) return true;
        const target = config.loginRoute || '/login';
        if (context.to !== target) globalThis.location.hash = `#${target}`;
        return false;
      });
      app.auth = auth;
    }
  };
}

export default createAuthSessionPlugin;
