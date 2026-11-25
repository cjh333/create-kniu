const EMPTY_AUTH_CONFIG = Object.freeze({
  STORAGE: Object.freeze({}),
  USER_LOGIN: Object.freeze({
    routes: Object.freeze({}),
    endpoints: Object.freeze({}),
    feedback: Object.freeze({ enabled: false })
  })
});

let authConfig = EMPTY_AUTH_CONFIG;

export function configureAuthConfig(config) {
  authConfig = config && typeof config === 'object' ? config : EMPTY_AUTH_CONFIG;
  return authConfig;
}

export function getAuthConfig() {
  return authConfig;
}

let authService = null;

export function configureAuthService(service) {
  if (service !== null && (!service || typeof service !== 'object')) {
    throw new TypeError('[kniu] auth service must be an object or null.');
  }
  authService = service;
  return authService;
}

export function getAuthService() {
  return authService;
}

const auth = new Proxy({}, {
  get(_, property) {
    const value = authService?.[property];
    if (typeof value === 'function') return value.bind(authService);
    if (value !== undefined) return value;
    throw new Error(`[kniu] Auth service is not installed; cannot access ${String(property)}.`);
  }
});

export { auth };
export default auth;