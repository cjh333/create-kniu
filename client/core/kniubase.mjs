import { create$, createEventBus, getTimeInZone, loadHtmlTemplate } from './kniueventer.mjs';
import { UTIL } from './kniutil.mjs';
import { AUTH } from './kniuauth.mjs';
import { loadController } from './kniumvvm.mjs';
import { SERVER } from '../config/server.js';

var KniuBase = (function () {
  function toComponentTag(path) {
    const fileName = path.split('/').pop().replace('.html', '');
    return 'app-' + fileName;
  }

  function toRoutePath(path) {
    const fileName = path.split('/').pop().replace('.html', '');
    return '/' + fileName;
  }

  function isPageView(path) {
    return !path.includes('/common/');
  }

  function findController(routes, templatePath, isDefault) {
    const routePath = toRoutePath(templatePath);
    const directMatch = routes.find(function (r) { return r.path === routePath; });
    if (directMatch) return directMatch.controller;
    if (isDefault) {
      const rootMatch = routes.find(function (r) { return r.path === '/'; });
      if (rootMatch) return rootMatch.controller;
      const fileName = templatePath.split('/').pop().replace('.html', '');
      return function loadDefaultController() {
        return loadController(`${fileName}Controller`);
      };
    }
    return null;
  }

  function isLoginRoute(hash) {
    return hash === '/login';
  }

  function routeRequiresAuth(hash, routes) {
    const route = (routes || []).find(function (r) { return r.path === hash; });
    if (!route) return !isLoginRoute(hash);
    return !!route.authRequired;
  }

  function createShadowComponent(templatePath, controller, buildScope) {
    let controllerPromise = null;

    function resolveController() {
      if (!controller) return Promise.resolve(null);
      if (controller.__kniuComponent) return Promise.resolve(controller);
      if (typeof controller !== 'function') return Promise.resolve(controller);
      if (!controllerPromise) controllerPromise = Promise.resolve().then(controller);
      return controllerPromise;
    }

    return class ShadowComponent extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._dispose = null;
        this._disposed = false;
        this._readyPromise = new Promise(function (resolve) {
          this._readyResolve = resolve;
        }.bind(this));
      }
      connectedCallback() {
        this._disposed = false;
        (async function () {
          const kniusystem = buildScope(this.shadowRoot);
          const resolvedController = await resolveController();
          this._dispose = await loadHtmlTemplate(
            templatePath,
            this.shadowRoot,
            undefined,
            kniusystem,
            resolvedController ? resolvedController.mount?.bind(resolvedController) : undefined,
          );
          if (this._disposed) {
            if (typeof this._dispose === 'function') {
              this._dispose();
              this._dispose = null;
            }
            return;
          }
          this._readyResolve?.();
        }).call(this);
      }
      disconnectedCallback() {
        this._disposed = true;
        if (typeof this._dispose === 'function') {
          this._dispose();
          this._dispose = null;
        }
      }
      get ready() {
        return this._readyPromise || Promise.resolve();
      }
    };
  }

  // 创建项目。
  function createApp() {
    const eventBus = createEventBus();
    eventBus.on('toast', function (msg) { UTIL.showToast(msg); });
    const navigateTo = function (path) {
      location.hash = path;
    };
    function onRouteChange(listener) {
      if (typeof listener !== 'function') return function () { };
      state.routeListeners.push(listener);
      try { listener(state.currentPath, null); } catch (e) { console.warn('[route] listener error', e); }
      return function () {
        const i = state.routeListeners.indexOf(listener);
        if (i >= 0) state.routeListeners.splice(i, 1);
      };
    }
    function notifyRouteChange(hash) {
      const prev = state.currentPath;
      state.currentPath = hash;
      state.routeListeners.slice().forEach(function (l) {
        try { l(hash, prev); } catch (e) { console.warn('[route] listener error', e); }
      });
    }
    const buildKniuSystemScope = function (shadowRoot) {
      return {
        $: create$(shadowRoot || document),
        root: shadowRoot || document,
        eventTo: eventBus,
        navigateTo: navigateTo,
        onRouteChange: onRouteChange,
        ui: UTIL.state,
        formatTime: function (date) {
          const pad = function (value) { return String(value).padStart(2, '0'); };
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
            `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        },
        getTimeInZone: getTimeInZone,
      };
    };
    const state = {
      routes: [],
      commonControllers: {},
      tags: [],
      pathToTag: new Map(),
      host: null,
      contentArea: null,
      currentViewTag: null,
      _renderLock: null,
      routeListeners: [],
      currentPath: '/'
    };
    return {
      use(routeConfig) {
        state.routes = routeConfig || [];
        return this;
      },
      useViews(controllers) {
        state.commonControllers = Object.fromEntries(
          Object.entries(controllers || {}).map(function ([viewName, controller]) {
            return [
              viewName,
              typeof controller === 'string'
                ? function loadViewController() { return loadController(controller); }
                : controller
            ];
          })
        );
        return this;
      },
      async mount(selector) {
        const mountSelector = selector || '#app';
        const routes = state.routes;
        const templates = globalThis.__VIEW_TEMPLATES__ || {};
        const allTemplates = Object.keys(templates).sort();
        const pageTemplates = allTemplates.filter(isPageView);
        const configuredHome = String(SERVER.HOME || 'home')
          .replace(/^\/+|\/+$/g, '') || 'home';
        const defaultTemplate = pageTemplates.find(function (templatePath) {
          return templatePath.split('/').pop().replace('.html', '') === configuredHome;
        }) || pageTemplates[0];
        allTemplates.forEach(function (templatePath) {
          const tagName = toComponentTag(templatePath);
          if (customElements.get(tagName)) return;
          const isPage = isPageView(templatePath);
          const isDefault = isPage && templatePath === defaultTemplate;
          const fileName = templatePath.split('/').pop().replace('.html', '');
          const controller = isPage
            ? findController(routes, templatePath, isDefault)
            : (state.commonControllers[fileName] || null);
          const ShadowComponent = createShadowComponent(templatePath, controller, buildKniuSystemScope);
          customElements.define(tagName, ShadowComponent);
        });
        pageTemplates.forEach(function (templatePath) {
          const tagName = toComponentTag(templatePath);
          const routePath = toRoutePath(templatePath);
          const isDefault = templatePath === defaultTemplate;
          state.pathToTag.set(routePath, tagName);
          if (isDefault) state.pathToTag.set('/', tagName);
          state.tags.push({ path: routePath, tag: tagName, template: templatePath, isDefault });
        });
        state.host = document.querySelector(mountSelector);
        if (!state.host) return this;
        await AUTH.restoreSession();
        const currentHash = location.hash.replace(/^#/, '') || '/';
        await this._renderRoute(currentHash);
        notifyRouteChange(currentHash);
        window.addEventListener('hashchange', function () {
          const hash = location.hash.replace(/^#/, '') || '/';
          notifyRouteChange(hash);
          this._renderRoute(hash);
        }.bind(this));
        return this;
      },
      async _renderRoute(hash) {
        if (!state.host) return;
        if (!isLoginRoute(hash) && routeRequiresAuth(hash, state.routes) && !AUTH.isLoggedIn()) {
          if (location.hash !== '#/login') location.hash = '/login';
          return;
        }
        if (state._renderLock) return state._renderLock;
        const lock = (async function () {
          const startTs = performance.now();
          UTIL.setLoading(true);
          try {
            if (isLoginRoute(hash)) {
              if (state.currentViewTag === 'app-login') return;
              state.host.innerHTML = '<app-login></app-login>';
              state.contentArea = null;
              state.currentViewTag = 'app-login';
              return;
            }
            const firstChild = state.host.firstElementChild;
            const hasMain = firstChild && firstChild.tagName.toLowerCase() === 'app-main';
            if (!hasMain) {
              state.host.innerHTML = '<app-main></app-main>';
            }
            const mainEl = state.host.firstElementChild;
            await mainEl.ready;
            if (!state.contentArea || !state.contentArea.isConnected) {
              state.contentArea = mainEl.shadowRoot.querySelector('article.kniu_web_aside_view');
            }
            if (!state.contentArea) return;
            const tag = state.pathToTag.get(hash) || state.pathToTag.get('/') || state.tags[0]?.tag;
            if (!tag) return;
            const existing = state.contentArea.firstElementChild;
            if (existing && existing.tagName.toLowerCase() === tag) return;
            if (state.currentViewTag === tag) return;
            state.contentArea.innerHTML = '<' + tag + '></' + tag + '>';
            state.currentViewTag = tag;
            const pageEl = state.contentArea.firstElementChild;
            if (pageEl?.ready) await pageEl.ready;
          } finally {
            const elapsed = performance.now() - startTs;
            const MIN_LOADING = 280;
            if (elapsed < MIN_LOADING) {
              await new Promise(function (resolve) { setTimeout(resolve, MIN_LOADING - elapsed); });
            }
            UTIL.setLoading(false);
          }
        })();
        lock.finally(function () {
          if (state._renderLock === lock) state._renderLock = null;
        });
        state._renderLock = lock;
        return lock;
      },
      eventBus: eventBus,
    };
  }

  return {
    createApp: createApp
  };
}());

export const createApp = KniuBase.createApp;
