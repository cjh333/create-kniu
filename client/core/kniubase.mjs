import EVENTER from './kniueventer.mjs';
import UTIL from './kniuui/kniuui.mjs';
import AUTH from './kniuauth.mjs';
import MVVM from './kniumvvm.mjs';
import SERVER from '../config/server.js';
import { toCommonKey, toComponentTag } from './kniuviewkey.mjs';
import { rememberLastRoute } from './kniulastroute.mjs';

const { create$, createEventBus, getTimeInZone, loadHtmlTemplate, formatTime } = EVENTER;
const { loadController, loadControllerFile } = MVVM;

var KniuBase = (function () {
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
    return path === '/login' || path === '/register' || path === '/forgot';
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
        this._abortController = null;
        this._readyPromise = new Promise(function (resolve, reject) {
          this._readyResolve = resolve;
          this._readyReject = reject;
        }.bind(this));
      }
      connectedCallback() {
        this._disposed = false;
        this._abortController?.abort();
        this._abortController = typeof AbortController === 'function' ? new AbortController() : null;
        const connectionAbortController = this._abortController;
        this._readyPromise = new Promise(function (resolve, reject) {
          this._readyResolve = resolve;
          this._readyReject = reject;
        }.bind(this));
        (async function () {
          const kniusystem = buildScope(this.shadowRoot);
          const resolvedController = await resolveController();
          this._dispose = await loadHtmlTemplate(
            templatePath,
            this.shadowRoot,
            connectionAbortController?.signal,
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
        }).call(this).catch(function (error) {
          if (connectionAbortController?.signal.aborted) {
            return;
          }
          if (this._disposed) {
            this._readyResolve?.();
            return;
          }
          this._readyReject?.(error);
          this.shadowRoot.textContent = '页面加载失败';
          globalThis.dispatchEvent?.(new CustomEvent('kniu-component-error', {
            detail: { templatePath: templatePath, error: error }
          }));
        }.bind(this));
      }
      disconnectedCallback() {
        this._disposed = true;
        this._abortController?.abort();
        this._abortController = null;
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

  function createApp() {
    const eventBus = createEventBus();
    let renderNavigation = null;
    function routePathFromHash(hash) {
      const value = String(hash || '').replace(/^#/, '') || '/';
      return (value.split('?')[0].split('#')[0]) || '/';
    }
    function isRegisteredRouteHash(hash) {
      const path = routePathFromHash(hash);
      return state.routes.some(function (route) {
        return route.path === path;
      });
    }
    function fixedTopNavbarHeight(root = document) {
      const nodes = root.querySelectorAll ? [...root.querySelectorAll('*')] : [];
      let height = 0;
      nodes.forEach(function (node) {
        if (node.matches?.('kniu-navbar[fixed="top"], kniu-navbar[fixed=""]')) {
          height = Math.max(height, node.getBoundingClientRect?.().height || node.offsetHeight || 0);
        }
        if (node.shadowRoot) height = Math.max(height, fixedTopNavbarHeight(node.shadowRoot));
      });
      return height;
    }
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
      state.routeKey = routeState.key;
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
      if (state.currentRoute) rememberLastRoute(state.currentRoute);
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
        UTIL.pruneEmptyAttributeTree?.(page);
        return page;
      }
      page.style.cssText = 'position:fixed;inset:0;z-index:-1;visibility:hidden;pointer-events:none;';
      page.setAttribute('aria-hidden', 'true');
      container.appendChild(page);
      try {
        if (page.ready) await page.ready;
        page.removeAttribute('style');
        page.removeAttribute('aria-hidden');
        UTIL.pruneEmptyAttributeTree?.(page);
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
        openExternalUrl: function (url) {
          const target = String(url == null ? '' : url).trim();
          if (!/^https?:\/\//i.test(target)) {
            console.warn('[kniu] openExternalUrl 仅接受 HTTP/HTTPS 地址：', target);
            return false;
          }
          const opened = globalThis.open?.(target, '_blank', 'noopener,noreferrer');
          return opened !== undefined;
        },
        ui: UTIL.state,
        formatTime: formatTime,
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
      lastRenderedRouteKey: null,
      routeKey: null,
      routeData: null,
      currentRoute: null
    };
    return {
      use(routeConfig) {
        state.routes = routeConfig || [];
        return this;
      },
      useViews(controllers) {
        state.commonControllers = Object.fromEntries(
          Object.entries(controllers || {}).map(function ([viewName, controller]) {
            if (typeof controller === 'string') {
              return [viewName, function loadViewController() { return loadControllerFile(controller); }];
            }
            if (controller === null || controller === undefined || typeof controller === 'function') {
              return [viewName, controller];
            }
            if (typeof controller === 'object' && controller.__kniuComponent === true) {
              return [viewName, controller];
            }
            throw new TypeError(
              '[kniubase] useViews 的值只能是控制器真实文件路径字符串、控制器函数或 controller() 产物，'
              + `收到「${viewName}」→ ${Array.isArray(controller) ? 'array' : typeof controller}。`
              + '键必须写成「区域/名称」，例如 { \'admin/common/aside\': \'admin/asideController.js\' }；不支持嵌套对象写法。'
            );
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
            routes.filter(function (item) {
              return item.controllerPath && item.controllerPath === route.controllerPath;
            }).forEach(function (item) { state.pathToTag.set(item.path, tagName); });
          }
          state.tags.push({ path: route?.path || null, tag: tagName, template: templatePath, isDefault });
        });
        state.host = document.querySelector(mountSelector);
        if (!state.host) return this;
        document.addEventListener('click', function (event) {
          const target = event.composedPath().find(function (node) {
            return node instanceof Element && node.matches('a[href]');
          });
          if (!target) return;
          const href = target.getAttribute('href') || '';
          if (!href.startsWith('#') || href.startsWith('#/')) return;
          const anchorId = decodeURIComponent(href.slice(1));
          const root = target.getRootNode();
          const anchor = root.querySelectorAll
            ? [...root.querySelectorAll('[id]')].find(function (node) { return node.id === anchorId; })
            : document.getElementById(anchorId);
          if (!anchor || isRegisteredRouteHash(anchorId)) return;
          event.preventDefault();
          event.stopPropagation();
          const top = anchor.getBoundingClientRect().top + globalThis.scrollY - fixedTopNavbarHeight();
          globalThis.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
          const currentRoute = state.currentPath || routePathFromHash(location.hash);
          const routeHash = currentRoute + '#' + anchorId;
          if (globalThis.history?.replaceState) {
            globalThis.history.replaceState(
              { ...(globalThis.history.state || {}), kniuRoute: globalThis.history.state?.kniuRoute },
              '',
              '#' + routeHash
            );
          }
        }, true);
        await AUTH.syncFrontIdentity();
        await AUTH.restoreSession();
        const currentHash = routePathFromHash(location.hash);
        const initialRouteState = globalThis.history?.state?.kniuRoute;
        state.routeData = initialRouteState?.path === currentHash ? initialRouteState.data : null;
        state.routeKey = initialRouteState?.path === currentHash ? initialRouteState.key : null;
        renderNavigation = this._renderRoute.bind(this);
        await this._renderRoute(currentHash);
        notifyRouteChange(currentHash);
        const handleBrowserNavigation = function () {
          const rawHash = location.hash.replace(/^#/, '') || '/';
          const hash = routePathFromHash(rawHash);
          if (!isRegisteredRouteHash(hash)) {
            const currentRoute = state.currentPath || '/';
            const anchor = rawHash.replace(/^[^#]*#/, '');
            const routeHash = anchor ? currentRoute + '#' + anchor : currentRoute;
            if (globalThis.history?.replaceState && location.hash !== '#' + routeHash) {
              globalThis.history.replaceState(
                { ...(globalThis.history.state || {}), kniuRoute: globalThis.history.state?.kniuRoute },
                '',
                '#' + routeHash
              );
            }
            return;
          }
          const routeState = globalThis.history?.state?.kniuRoute;
          state.routeData = routeState?.path === hash ? routeState.data : null;
          state.routeKey = routeState?.path === hash ? routeState.key : null;
          notifyRouteChange(hash);
          this._renderRoute(hash);
        }.bind(this);
        window.addEventListener('hashchange', handleBrowserNavigation);
        window.addEventListener('popstate', handleBrowserNavigation);
        return this;
      },
      async _renderRoute(hash) {
        if (!state.host) return;
        if (state._renderLock) {
          state.pendingHash = hash;
          return state._renderLock;
        }
        const pathOnly = (hash.split('?')[0]) || '/';
        const currentRoute = state.routes.find(function (item) { return item.path === pathOnly; });
        const useLoading = !isLoginRoute(hash);
        const lock = (async function () {
          const startTs = performance.now();
          UTIL.reconcileDocumentScrollLock?.();
          UTIL.pruneEmptyRootAttributes?.();
          if (useLoading) UTIL.setLoading(true);
          try {
            if (isLoginRoute(hash)) {
              const loginTag = state.pathToTag.get(pathOnly) || state.pathToTag.get('/login');
              if (!loginTag || (state.currentViewTag === loginTag && hash === state.lastRenderedHash && state.routeKey === state.lastRenderedRouteKey)) return;
              await replacePageWhenReady(state.host, loginTag);
              globalThis.dispatchEvent?.(new CustomEvent('kniu-route-rendered', { detail: { path: pathOnly } }));
              state.contentArea = null;
              state.currentViewTag = loginTag;
              state.lastRenderedHash = hash;
              state.lastRenderedRouteKey = state.routeKey;
              state.currentRoute = { path: pathOnly, data: state.routeData };
              return;
            }
            const route = currentRoute;
            const useAdminShell = !!route && String(route.controllerPath || '').startsWith('admin/');
            if (!useAdminShell) {
              const tag = state.pathToTag.get(pathOnly) || state.pathToTag.get('/') || state.tags[0]?.tag;
              if (!tag) return;
              const existing = getActivePage(state.host);
              if (existing && existing.tagName.toLowerCase() === tag && state.currentViewTag === tag && hash === state.lastRenderedHash && state.routeKey === state.lastRenderedRouteKey) return;
              await replacePageWhenReady(state.host, tag);
              globalThis.dispatchEvent?.(new CustomEvent('kniu-route-rendered', { detail: { path: pathOnly } }));
              state.contentArea = null;
              state.currentViewTag = tag;
              state.lastRenderedHash = hash;
              state.lastRenderedRouteKey = state.routeKey;
              state.currentRoute = { path: pathOnly, data: state.routeData };
              return;
            }
            const mainTag = state.commonTags.get('admin/common/main') || 'kniu-system-admin-common-main';
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
            if (existing && existing.tagName.toLowerCase() === tag && state.currentViewTag === tag && hash === state.lastRenderedHash && state.routeKey === state.lastRenderedRouteKey) return;
            await replacePageWhenReady(state.contentArea, tag);
            globalThis.dispatchEvent?.(new CustomEvent('kniu-route-rendered', { detail: { path: pathOnly } }));
            state.currentViewTag = tag;
            state.lastRenderedHash = hash;
            state.lastRenderedRouteKey = state.routeKey;
            state.currentRoute = { path: pathOnly, data: state.routeData };
          } catch (error) {
            console.error('[route] render failed:', error);
            UTIL.msg?.({ content: '页面加载失败，请重试', type: 'error' });
          } finally {
            if (useLoading) {
              const elapsed = performance.now() - startTs;
              const MIN_LOADING = 280;
              if (elapsed < MIN_LOADING) {
                await new Promise(function (resolve) { setTimeout(resolve, MIN_LOADING - elapsed); });
              }
              UTIL.setLoading(false);
              UTIL.pruneEmptyRootAttributes?.();
            }
          }
        }());
        lock.finally(function () {
          if (state._renderLock === lock) state._renderLock = null;
          UTIL.pruneEmptyAttributeTree?.(state.host);
          const pendingHash = state.pendingHash;
          state.pendingHash = null;
          if (pendingHash && (pendingHash !== state.lastRenderedHash || state.routeKey !== state.lastRenderedRouteKey)) {
            this._renderRoute(pendingHash);
          }
        }.bind(this));
        state._renderLock = lock;
        return lock;
      },
      eventBus: eventBus,
      navigateTo: navigateTo,
      getRouteData: function () { return state.routeData; },
    };
  }

  return {
    createApp: createApp
  };
}());

export default KniuBase.createApp;