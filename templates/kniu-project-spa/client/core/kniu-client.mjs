import { createRouter } from './kniu-router.mjs';
import { routes } from '../config/router.js';
import viewer from '../config/viewer.js';
import { REQUEST } from './kniu-request.mjs';
import { ERROR } from './kniu-error.mjs';
import PROJECT_CONFIG from '../../kniu.config.js';
import { configureUi } from './kniu-ui-config.mjs';
import { createIdentity } from './kniu-identity.mjs';
import { createAuth } from './kniu-auth.mjs';
import { createAuthSessionPlugin } from './kniu-auth-session-plugin.mjs';
import { configureIdentityService } from './kniu-identity-service.mjs';
import { createObservability } from './kniu-observability.mjs';
import { createStore } from './kniu-store.mjs';
import { createServiceWorkerPlugin } from './kniu-service-worker.mjs';
import { auditAccessibility } from './kniu-a11y.mjs';
import { configureTemplateEngine, mountTemplateHead } from './kniu-template.mjs';

const UI_CONFIG = configureUi({ COMPONENTS: PROJECT_CONFIG.components, THEME: PROJECT_CONFIG.theme });
if (PROJECT_CONFIG.security?.cspNonce) globalThis.__KNIU_CSP_NONCE__ = PROJECT_CONFIG.security.cspNonce;

export const ROUTER = {
  name: 'router',
  install(app) {
    app.router = createRouter({ root: app.root, routes, viewer, loading: PROJECT_CONFIG.loading });
  }
};

export const TEMPLATE = {
  name: 'template',
  install() {
    configureTemplateEngine({ aliases: PROJECT_CONFIG.resolve?.alias, head: PROJECT_CONFIG.template?.head });
    mountTemplateHead();
  }
};

export function CLIENT() {
  const identity = createIdentity(PROJECT_CONFIG.identity);
  const auth = createAuth({ identity, storageKey: PROJECT_CONFIG.auth?.storageKey });
  const observability = createObservability(PROJECT_CONFIG.observability);
  const store = createStore(PROJECT_CONFIG.store?.state, PROJECT_CONFIG.store);
  configureIdentityService(identity);
  const app = {
    root: null,
    router: null,
    plugins: [],
    config: { request: { ...(PROJECT_CONFIG.request || {}), getAccessToken: () => identity.getIdentity().token } },
    identity,
    auth,
    observability,
    store,
    ui: UI_CONFIG,
    auditAccessibility: () => auditAccessibility(app.root),
    installedPlugins: new Set(),
    onError: null,
    use(plugin) {
      if (!plugin || app.plugins.includes(plugin)) return app;
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
      if (!app.root) throw new Error(`找不到挂载节点：${selector}`);
      observability.install();
      for (const plugin of app.plugins) {
        if (!app.installedPlugins.has(plugin)) {
          plugin.install?.(app);
          if (typeof plugin === 'function') plugin(app);
          app.installedPlugins.add(plugin);
        }
      }
      if (!app.router) app.use(ROUTER);
      if (!app.request) app.use(REQUEST);
      if (!app.plugins.includes(ERROR)) app.use(ERROR);
      if (!app.plugins.includes(TEMPLATE)) app.use(TEMPLATE);
      if (PROJECT_CONFIG.serviceWorker?.enabled === true) app.use(createServiceWorkerPlugin(PROJECT_CONFIG.serviceWorker));
      if (PROJECT_CONFIG.auth?.enabled !== false) {
        app.use(createAuthSessionPlugin({ auth, identity, request: app.request, config: PROJECT_CONFIG.auth }));
      }
      await app.authReady;
      await app.router.start();
      return app;
    }
  };
  return app;
}