import { getContracts, isIdentityFailure, sessionBody, loginRedirectHash, routeFromLocation, routeHref } from './Kniu-Contracts.mjs';
import { raceTimeout } from './Kniu-Util.mjs';

const AUTH_READY_TIMEOUT = 4000;

export function createAuthSession(options = {}) {
  return {
    name: 'auth-session',
    install(app) {
      const { auth, identity, request, config = {} } = options;
      if (!auth || !identity || !request) throw new TypeError('[kniu] auth-session requires auth, identity and request.');
      auth.restore();
      const authContracts = getContracts().auth;
      const AUTH_ROUTES = new Set(authContracts.anonymousRoutes);
      const loginRoute = config.loginRoute || authContracts.loginRoute;
      const currentPath = () => routeFromLocation(globalThis.location, getContracts(), '/');
      let redirecting = false;
      let probingSession = false;
      let revalidatingSession = null;
      const sessionUser = (result) => {
        const payload = result?.data && typeof result.data === 'object' ? result.data : result;
        if (!payload || typeof payload !== 'object') return null;
        if (payload.user && typeof payload.user === 'object') return payload.user;
        if (payload.loggedIn === true) return { ...payload };
        return null;
      };
      const redirectToLogin = () => {
        if (redirecting) return;
        const here = currentPath();
        if (here === loginRoute || AUTH_ROUTES.has(here)) return;
        redirecting = true;
        globalThis.location.hash = loginRedirectHash(here);
        setTimeout(() => { redirecting = false; }, 1000);
      };
      const skipSessionProbe = AUTH_ROUTES.has(currentPath()) || currentPath() === loginRoute;
      app.authReady = config.sessionUrl && !skipSessionProbe
        ? (async () => {
          probingSession = true;
          try {
            const result = await request.post(config.sessionUrl, sessionBody(identity.getIdentity().token), { auth: false });
            const user = typeof config.sessionUser === 'function'
              ? config.sessionUser(result)
              : sessionUser(result);
            if (user && typeof user === 'object') {
              if (typeof config.sessionIdentity === 'function') {
                const nextIdentity = config.sessionIdentity(result, identity.getIdentity());
                if (nextIdentity && typeof nextIdentity === 'object') identity.setIdentity(nextIdentity);
              }
              auth.setUser(user);
            }
            else {
              auth.markLoggedOut();
              identity.clearIdentity();
            }
          } catch {
            auth.markLoggedOut();
            identity.clearIdentity();
          } finally { probingSession = false; }
        })()
        : Promise.resolve();
      request.useResponseInterceptor(async (result) => {
        if (probingSession) return result;
        if (!isIdentityFailure(result)) return result;
        if (result.authVersion != null && result.authVersion !== auth.version) return result;
        if (config.sessionUrl && !revalidatingSession) {
          revalidatingSession = (async () => {
            probingSession = true;
            try {
              const response = await request.post(config.sessionUrl, sessionBody(identity.getIdentity().token), { auth: false, deduplicate: false });
              return typeof config.sessionUser === 'function' ? config.sessionUser(response) : sessionUser(response);
            } catch (_) {
              return undefined;
            } finally {
              probingSession = false;
              revalidatingSession = null;
            }
          })();
        }
        const revalidatedUser = revalidatingSession ? await revalidatingSession : null;
        if (result.authVersion != null && result.authVersion !== auth.version) return result;
        if (revalidatedUser) return result;
        auth.markLoggedOut();
        identity.clearIdentity();
        redirectToLogin();
        return result;
      });
      app.router?.beforeEach(async (context) => {
        const meta = context.route.meta || {};
        const requiredPermissions = Array.isArray(meta.permissions) ? meta.permissions : meta.permission ? [meta.permission] : [];
        const requiredRoles = Array.isArray(meta.roles) ? meta.roles : meta.role ? [meta.role] : [];
        if (!meta.requiresAuth && !requiredPermissions.length && !requiredRoles.length) return true;
        await raceTimeout(app.authReady, AUTH_READY_TIMEOUT);
        const rejected = (meta.requiresAuth && !auth.isLoggedIn()) || requiredPermissions.some((permission) => !auth.can(permission)) || requiredRoles.length && !requiredRoles.some((role) => auth.hasRole(role));
        if (!rejected) return true;
        const target = config.loginRoute || getContracts().auth.loginRoute;
        if (context.to !== target) globalThis.location.hash = routeHref(target, getContracts());
        return false;
      });
      app.auth = auth;
    }
  };
}
export const createAuthSessionPlugin = createAuthSession;
export default createAuthSession;