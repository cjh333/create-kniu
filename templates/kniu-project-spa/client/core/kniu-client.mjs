import { configureContracts, getContracts, responseMessage } from './Kniu-Contracts.mjs';
import { configureComponentRegistry } from './Kniu-ComponentManifest.mjs';
import { getDefaultScope, setDefaultScope, scopeSet, withScope } from './Kniu-Scope.mjs';
import { setComponentModuleLoader, releaseRuntimeNodes } from './Kniu-Runtime.mjs';
import { createRouter } from './Kniu-Router.mjs';
setComponentModuleLoader(() => import('./Kniu-Components.mjs'));
import { REQUEST, createRequest, REQUEST_WORKER_URL } from './Kniu-Request.mjs';
import { ERROR } from './Kniu-Error.mjs';
import { configureUi } from './Kniu-UiConfig.mjs';
import { createIdentity } from './Kniu-Identity.mjs';
import { createAuth } from './Kniu-Auth.mjs';
import { createAuthSessionPlugin } from './Kniu-AuthSession.mjs';
import { configureIdentityService } from './Kniu-IdentityService.mjs';
import { configureAuthService, configureAuthConfig } from './Kniu-AuthService.mjs';
import { createObservability } from './Kniu-Observability.mjs';
import { createStore } from './Kniu-Store.mjs';
import { createServiceWorkerPlugin } from './Kniu-ServiceWorker.mjs';
import { createProtocolPlugin } from './Kniu-Protocol.mjs';
import { configureProxy } from './Kniu-Proxy.mjs';
import { auditAccessibility } from './Kniu-A11y.mjs';
import { configureTemplateEngine, mountTemplateHead } from './Kniu-TemplateEngine.mjs';

export function createRouterPlugin({ routes = [], views = {}, loading = null, ...routerOptions } = {}) {
  return {
    name: 'router',
    install(app) {
      if (!app.request) app.request = createRequest({ workerUrl: REQUEST_WORKER_URL, ...app.config?.request });
      app.router = createRouter({ root: app.root, routes, views, loading, request: app.request, ...routerOptions });
    }
  };
}

export function createTemplatePlugin({ aliases = {}, head = {} } = {}) {
  return {
    name: 'template',
    install() {
      configureTemplateEngine({ aliases, head });
      mountTemplateHead();
    }
  };
}

export function createClient({ config = {}, routes = [], views = {}, globalCss = '', scope } = {}) {
  const runtimeScope = scope || getDefaultScope();
  setDefaultScope(runtimeScope);
  const projectConfig = config && typeof config === 'object' ? config : {};
  configureContracts(projectConfig.contracts);
  if (projectConfig.debug && typeof projectConfig.debug === 'object') configureContracts({ debug: projectConfig.debug });
  if (projectConfig.components?.registry || Array.isArray(projectConfig.components?.business)) {
    configureComponentRegistry({
      ...(projectConfig.components.registry || {}),
      ...(Array.isArray(projectConfig.components.business) ? { business: projectConfig.components.business } : {})
    });
  }
  configureAuthConfig({ STORAGE: {}, USER_LOGIN: { routes: {}, endpoints: {}, feedback: { enabled: false }, ...projectConfig.userLogin } });
  if (projectConfig.security?.cspNonce) scopeSet('__KNIU_CSP_NONCE__', projectConfig.security.cspNonce);
  const uiConfig = configureUi({ COMPONENTS: projectConfig.components, THEME: projectConfig.theme, globalCss });
  configureProxy(projectConfig.imageProxy);
  if (projectConfig.paths?.custom) scopeSet('__KNIU_CUSTOM_PATH__', projectConfig.paths.custom);
  const identity = createIdentity(projectConfig.identity);
  let auth;
  const requestOptions = { workerUrl: REQUEST_WORKER_URL, ...(projectConfig.request || {}), getAccessToken: () => identity.getIdentity().token, getAuthVersion: () => auth?.version };
  const request = createRequest(requestOptions);
  auth = createAuth({
    identity,
    storageKey: projectConfig.auth?.storageKey,
    onLogout: projectConfig.auth?.logoutUrl ? async () => {
      const result = await request.post(projectConfig.auth.logoutUrl, {});
      if (typeof projectConfig.auth.logoutSuccess === 'function' && !projectConfig.auth.logoutSuccess(result)) {
        throw new Error(responseMessage(result, getContracts().messages.logoutFailed));
      }
    } : null
  });
  auth.restore();
  const observability = createObservability(projectConfig.observability);
  const store = createStore(projectConfig.store?.state, projectConfig.store);
  configureIdentityService(identity);
  configureAuthService(auth);
  const app = {
    root: null,
    router: null,
    plugins: [],
    config: { request: requestOptions },
    request,
    identity,
    auth,
    observability,
    store,
    ui: uiConfig,
    auditAccessibility: () => auditAccessibility(app.root),
    installedPlugins: new Set(),
    onError: null,
    scope: runtimeScope,
    withScope: (fn) => withScope(runtimeScope, fn),
    use(plugin) {
      if (!plugin || app.plugins.includes(plugin)) return app;
      const name = typeof plugin === 'function' ? plugin.name : plugin?.name;
      if (name && app.plugins.some((item) => (typeof item === 'function' ? item.name : item?.name) === name)) return app;
      app.plugins.push(plugin);
      if (app.root && !app.installedPlugins.has(plugin)) {
        plugin.install?.(app);
        if (typeof plugin === 'function') plugin(app);
        app.installedPlugins.add(plugin);
      }
      return app;
    },
    async mount(selector) {
      app.root = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (!app.root) throw new Error(`${getContracts().messages.mountNodeMissing}${selector}`);
      observability.install();
      for (const plugin of app.plugins) {
        if (!app.installedPlugins.has(plugin)) {
          plugin.install?.(app);
          if (typeof plugin === 'function') plugin(app);
          app.installedPlugins.add(plugin);
        }
      }
      if (!app.router) app.use(createRouterPlugin({ routes, views, loading: projectConfig.loading, ...(projectConfig.router || {}) }));
      if (!app.request) app.use(REQUEST);
      if (!app.plugins.includes(ERROR)) app.use(ERROR);
      if (!app.plugins.some((plugin) => plugin?.name === 'template')) app.use(createTemplatePlugin({ aliases: projectConfig.resolve?.alias, head: projectConfig.template?.head }));
      if (projectConfig.serviceWorker?.enabled === true) app.use(createServiceWorkerPlugin(projectConfig.serviceWorker));
      if (projectConfig.protocol) app.use(createProtocolPlugin(projectConfig.protocol));
      if (projectConfig.auth?.enabled !== false) {
        app.use(createAuthSessionPlugin({ auth, identity, request: app.request, config: projectConfig.auth }));
      }
      app.authReady?.catch?.(() => { });
      await app.router.start();
      return app;
    },
    destroy() {
      const options = arguments[0] || {};
      return withScope(runtimeScope, () => {
        app.router?.destroy?.();
        observability.uninstall?.();
        app.plugins.splice(0);
        app.installedPlugins.clear();
        if (options.cleanGlobals) runtimeScope.clear();
        if (options.cleanDom) releaseRuntimeNodes();
        return app;
      });
    }
  };
  return app;
}

export const CLIENT = createClient;
export const ROUTER = createRouterPlugin;
export const TEMPLATE = createTemplatePlugin;