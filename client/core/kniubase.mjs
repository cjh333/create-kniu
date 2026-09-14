import KniuEventer from './kniueventer.mjs';
import UTIL from './kniuui.js';
import AUTH from './kniuauth.mjs';
import KniuMvvm from './kniumvvm.mjs';
import SERVER from '../config/server.js';

const { create$, createEventBus, getTimeInZone, loadHtmlTemplate } = KniuEventer;
const { loadController } = KniuMvvm;

var KniuBase = (function () {
  function toComponentTag(path) {
    const normalized = String(path || '').replaceAll('\\', '/').replace(/\.html$/, '');
    const parts = normalized.split('/').filter(Boolean);
    const commonIndex = parts.lastIndexOf('common');
    const names = commonIndex > 0 ? parts.slice(commonIndex - 1) : parts.slice(-2);
    return 'kniu-system-' + names.join('-').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  }

  function toCommonKey(path) {
    const parts = String(path || '').replaceAll('\\', '/').replace(/\.html$/, '').split('/').filter(Boolean);
    const commonIndex = parts.lastIndexOf('common');
    return commonIndex > 0 ? parts[commonIndex - 1] + '/' + parts[parts.length - 1] : '';
  }

  function toRoutePath(path) {
    const fileName = path.split('/').pop().replace('.html', '');
    return '/' + fileName;
  }

  function isPageView(path) {
    return !path.includes('/common/');
  }

  function controllerMatchesTemplate(controller, templatePath) {
    if (!controller) return true;
    const parts = String(templatePath || '').replaceAll('\\', '/').split('/').filter(Boolean);
    const folder = parts.length > 1 ? parts[parts.length - 2] : '';
    return String(controller || '').replaceAll('\\', '/').startsWith(folder + '/');
  }

  function findRoute(routes, templatePath, isDefault) {
    const routePath = toRoutePath(templatePath);
    if (isDefault) {
      const rootMatch = routes.find(function (r) {
        return r.path === '/' && controllerMatchesTemplate(r.controllerPath, templatePath);
      });
      if (rootMatch) return rootMatch;
    }
    return routes.find(function (r) {
      return r.path === routePath && controllerMatchesTemplate(r.controllerPath, templatePath);
    }) || null;
  }

  function findController(routes, templatePath, isDefault) {
    return findRoute(routes, templatePath, isDefault)?.controller || null;
  }

  function isLoginRoute(hash) {
    const path = String(hash || '').split('?')[0];
    return path === '/login' || path === '/register';
  }

  function routeRequiresAuth(hash, routes) {
    const path = String(hash || '').split('?')[0] || '/';
    const route = (routes || []).find(function (r) { return r.path === path; });
    if (!route) return !isLoginRoute(path);
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
    let renderNavigation = null;
    const navigateTo = function (path, data) {
      const rawPath = String(path || '/').trim().replace(/^#/, '');
      const normalizedPath = '/' + rawPath.replace(/^\/+|\/+$/g, '');
      const routePath = normalizedPath === '/' ? '/' : normalizedPath;
      const routeState = {
        path: routePath,
        data: data && typeof data === 'object' ? data : null,
        key: Date.now() + Math.random()
      };
      state.routeData = routeState.data;
      if (globalThis.history?.pushState) {
        globalThis.history.pushState({ ...(globalThis.history.state || {}), kniuRoute: routeState }, '', '#' + routePath);
        notifyRouteChange(routePath);
        renderNavigation?.(routePath);
        return;
      }
      location.hash = routePath;
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
    function getActivePage(container) {
      if (!container) return null;
      return [...container.children].find(function (node) {
        return node.tagName?.toLowerCase().startsWith('kniu-system-');
      }) || null;
    }

    async function replacePageWhenReady(container, tag) {
      if (!container || !tag) return null;
      const previous = getActivePage(container);
      const page = document.createElement(tag);
      if (!previous) {
        container.appendChild(page);
        if (page.ready) await page.ready;
        return page;
      }
      page.style.cssText = 'position:fixed;inset:0;z-index:-1;visibility:hidden;pointer-events:none;';
      page.setAttribute('aria-hidden', 'true');
      container.appendChild(page);
      try {
        if (page.ready) await page.ready;
        page.removeAttribute('style');
        page.removeAttribute('aria-hidden');
        // page 已在容器内，不能再次移动；只清理其它页面节点，保留模块脚本等非页面节点。
        [...container.children].forEach(function (node) {
          if (node !== page && node.tagName?.toLowerCase().startsWith('kniu-system-')) node.remove();
        });
        return page;
      } catch (error) {
        page.remove();
        throw error;
      }
    }
    const buildKniuSystemScope = function (shadowRoot) {
      return {
        $: create$(shadowRoot || document),
        root: shadowRoot || document,
        eventTo: eventBus,
        navigateTo: navigateTo,
        getRouteData: function () { return state.routeData; },
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
      commonTags: new Map(),
      tags: [],
      pathToTag: new Map(),
      host: null,
      contentArea: null,
      currentViewTag: null,
      _renderLock: null,
      routeListeners: [],
      currentPath: '/',
      lastRenderedHash: null,
      routeData: null
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
          const templateName = templatePath.replaceAll('\\', '/').replace(/\.html$/, '').replace(/^\/+|\/+$/g, '');
          return templateName === configuredHome || templateName.endsWith('/' + configuredHome);
        }) || pageTemplates[0];
        allTemplates.forEach(function (templatePath) {
          const tagName = toComponentTag(templatePath);
          if (customElements.get(tagName)) return;
          const isPage = isPageView(templatePath);
          const isDefault = isPage && templatePath === defaultTemplate;
          const fileName = templatePath.split('/').pop().replace('.html', '');
          const commonKey = isPage ? '' : toCommonKey(templatePath);
          const controller = isPage
            ? findController(routes, templatePath, isDefault)
            : (state.commonControllers[commonKey] || state.commonControllers[fileName] || null);
          const ShadowComponent = createShadowComponent(templatePath, controller, buildKniuSystemScope);
          customElements.define(tagName, ShadowComponent);
          if (!isPage && commonKey) state.commonTags.set(commonKey, tagName);
        });
        pageTemplates.forEach(function (templatePath) {
          const tagName = toComponentTag(templatePath);
          const isDefault = templatePath === defaultTemplate;
          const route = findRoute(routes, templatePath, isDefault);
          if (route) {
            state.pathToTag.set(route.path, tagName);
            // 同一 Controller 可以注册多个明确路由，例如 /admin 与 /home 共用后台首页。
            routes.filter(function (item) {
              return item.controllerPath && item.controllerPath === route.controllerPath;
            }).forEach(function (item) { state.pathToTag.set(item.path, tagName); });
          }
          state.tags.push({ path: route?.path || null, tag: tagName, template: templatePath, isDefault });
        });
        state.host = document.querySelector(mountSelector);
        if (!state.host) return this;
        await AUTH.restoreSession();
        const currentHash = location.hash.replace(/^#/, '') || '/';
        const initialRouteState = globalThis.history?.state?.kniuRoute;
        state.routeData = initialRouteState?.path === currentHash ? initialRouteState.data : null;
        renderNavigation = this._renderRoute.bind(this);
        await this._renderRoute(currentHash);
        notifyRouteChange(currentHash);
        const handleBrowserNavigation = function () {
          const hash = location.hash.replace(/^#/, '') || '/';
          const routeState = globalThis.history?.state?.kniuRoute;
          state.routeData = routeState?.path === hash ? routeState.data : null;
          notifyRouteChange(hash);
          this._renderRoute(hash);
        }.bind(this);
        window.addEventListener('hashchange', handleBrowserNavigation);
        window.addEventListener('popstate', handleBrowserNavigation);
        return this;
      },
      async _renderRoute(hash) {
        if (!state.host) return;
        if (!isLoginRoute(hash) && routeRequiresAuth(hash, state.routes) && !AUTH.isLoggedIn()) {
          if (location.hash !== '#/login') location.hash = '/login';
          return;
        }
        if (state._renderLock) {
          state.pendingHash = hash;
          return state._renderLock;
        }
        const pathOnly = (hash.split('?')[0]) || '/';
        const currentRoute = state.routes.find(function (item) { return item.path === pathOnly; });
        // 前台（index）与管理台（admin）路由切换均显示全局加载遮罩；登录页不显示。
        const useLoading = !isLoginRoute(hash);
        const lock = (async function () {
          const startTs = performance.now();
          if (useLoading) UTIL.setLoading(true);
          try {
            if (isLoginRoute(hash)) {
              const loginTag = state.pathToTag.get(pathOnly) || state.pathToTag.get('/login');
              // /login 与 /register 共用同一模板标签，但必须按路径重新挂载，
              // 否则同一标签会被误判为当前页面，导致登录/注册表单无法互相切换。
              if (!loginTag || (state.currentViewTag === loginTag && hash === state.lastRenderedHash)) return;
              await replacePageWhenReady(state.host, loginTag);
              globalThis.dispatchEvent?.(new CustomEvent('kniu-route-rendered', { detail: { path: pathOnly } }));
              state.contentArea = null;
              state.currentViewTag = loginTag;
              state.lastRenderedHash = hash;
              return;
            }
            const route = currentRoute;
            const isFrontendRoute = route && String(route.controllerPath || '').startsWith('index/');
            if (route && (!route.authRequired || isFrontendRoute)) {
              const tag = state.pathToTag.get(pathOnly) || state.pathToTag.get('/') || state.tags[0]?.tag;
              if (!tag) return;
              const existing = getActivePage(state.host);
              if (existing && existing.tagName.toLowerCase() === tag && state.currentViewTag === tag && hash === state.lastRenderedHash) return;
              await replacePageWhenReady(state.host, tag);
              globalThis.dispatchEvent?.(new CustomEvent('kniu-route-rendered', { detail: { path: pathOnly } }));
              state.contentArea = null;
              state.currentViewTag = tag;
              state.lastRenderedHash = hash;
              return;
            }
            const mainTag = state.commonTags.get('admin/main') || 'kniu-system-admin-common-main';
            const firstChild = getActivePage(state.host);
            const hasMain = firstChild && firstChild.tagName.toLowerCase() === mainTag;
            if (!hasMain) {
              state.host.innerHTML = '<' + mainTag + '></' + mainTag + '>';
            }
            const mainEl = state.host.firstElementChild;
            await mainEl.ready;
            if (!state.contentArea || !state.contentArea.isConnected) {
              state.contentArea = mainEl.shadowRoot.querySelector('article.kniu_web_aside_view');
            }
            if (!state.contentArea) return;
            const tag = state.pathToTag.get(pathOnly) || state.pathToTag.get('/') || state.tags[0]?.tag;
            if (!tag) return;
            const existing = state.contentArea.firstElementChild;
            // 同一视图但查询参数（如 ?id=）变化时需要重新渲染，以便详情页读取新参数。
            if (existing && existing.tagName.toLowerCase() === tag && state.currentViewTag === tag && hash === state.lastRenderedHash) return;
            await replacePageWhenReady(state.contentArea, tag);
            globalThis.dispatchEvent?.(new CustomEvent('kniu-route-rendered', { detail: { path: pathOnly } }));
            state.currentViewTag = tag;
            state.lastRenderedHash = hash;
          } finally {
            if (useLoading) {
              const elapsed = performance.now() - startTs;
              const MIN_LOADING = 280;
              if (elapsed < MIN_LOADING) {
                await new Promise(function (resolve) { setTimeout(resolve, MIN_LOADING - elapsed); });
              }
              UTIL.setLoading(false);
            }
          }
        })();
        lock.finally(function () {
          if (state._renderLock === lock) state._renderLock = null;
          const pendingHash = state.pendingHash;
          state.pendingHash = null;
          if (pendingHash && pendingHash !== state.lastRenderedHash) {
            this._renderRoute(pendingHash);
          }
        }.bind(this));
        state._renderLock = lock;
        return lock;
      },
      eventBus: eventBus,
      navigateTo: navigateTo,
    };
  }

  return {
    createApp: createApp
  };
}());

export default KniuBase.createApp;
