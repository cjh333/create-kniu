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