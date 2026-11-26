import { getContracts, limitValue, routeFromLocation, routeHref, routeSeparator } from './Kniu-Contracts.mjs';
import { scopeGet } from './Kniu-Scope.mjs';
import { trackRuntimeNode } from './Kniu-Runtime.mjs';
import { escapeHtml, renderTemplate, restoreStaticBlocks } from './Kniu-TemplateEngine.mjs';
import { createRequest } from './Kniu-Request.mjs';
import { preloadComponents } from './Kniu-ComponentLoader.mjs';
import { updateHead } from './Kniu-Head.mjs';
import { ensureShadowRoot, syncGlobalStyles } from './Kniu-Shadow.mjs';
import { createBinder, retargetEvent } from './Kniu-Binding.mjs';
import { collectRefs, createMountHidden, mountViewTree, pruneEmptyAttributes, removeClass, recordIncludeSnapshots, expandStyleImports } from './Kniu-ViewMount.mjs';
import { patchRenderedScope } from './Kniu-Diff.mjs';
import { kniuDebug, kniuWarn, kniuError, KNDEBUG } from './Kniu-Debug.mjs';
import { reactive } from './Kniu-MVVM.mjs';
import { maskExternalImages, hydrateExternalImages } from './Kniu-Proxy.mjs';
import { recordRoute } from './Kniu-Devtools.mjs';
import { showBootLoading, hideBootLoading } from './Kniu-BootLoading.mjs';

export { retargetEvent };

async function renderViewHtml(source, model, options) {
  return maskExternalImages(expandStyleImports(renderTemplate(source, model, options), globalThis.document?.baseURI || globalThis.location?.href || ''));
}

function stableIncludeHtml(html) {
  return String(html ?? '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, (tag) => tag.replace(/="[^"]*"/g, '=""'))
    .replace(/>[^<]+</g, '><');
}

const nodeKeyOf = (node) => (node.nodeType === 3 ? '#text' : node.localName);

function syncRenderedNode(from, to) {
  if (from.nodeType === 3) {
    if (!to || to.nodeType !== 3) return false;
    if (to.nodeValue !== from.nodeValue) to.nodeValue = from.nodeValue;
    return true;
  }
  if (!to || to.nodeType !== 1 || to.localName !== from.localName) return false;
  if (!/^(style|script|template)$/i.test(from.localName)) {
    for (const attribute of from.attributes) {
      if (to.getAttribute(attribute.name) !== attribute.value) to.setAttribute(attribute.name, attribute.value);
    }
  }
  const sourceChildren = [...from.childNodes].filter((node) => node.nodeType === 1 || node.nodeType === 3);
  const targetChildren = [...to.childNodes].filter((node) => node.nodeType === 1 || node.nodeType === 3);
  const used = new Set();
  const counters = new Map();
  for (const child of sourceChildren) {
    const key = nodeKeyOf(child);
    const ordinal = counters.get(key) || 0;
    counters.set(key, ordinal + 1);
    let matched = null;
    let seen = 0;
    for (const candidate of targetChildren) {
      if (used.has(candidate) || nodeKeyOf(candidate) !== key) continue;
      if (seen === ordinal) { matched = candidate; break; }
      seen += 1;
    }
    if (matched) { used.add(matched); syncRenderedNode(child, matched); }
  }
  return true;
}

function syncOrdinalChildren(targetRoot, source) {
  const sourceChildren = [...source.childNodes].filter((node) => node.nodeType === 1 || node.nodeType === 3);
  const targetChildren = [...targetRoot.childNodes].filter((node) => node.nodeType === 1 || node.nodeType === 3);
  if (!sourceChildren.length) return false;
  let ok = false;
  const used = new Set();
  const counters = new Map();
  for (const child of sourceChildren) {
    const key = nodeKeyOf(child);
    const ordinal = counters.get(key) || 0;
    counters.set(key, ordinal + 1);
    let matched = null;
    let seen = 0;
    for (const candidate of targetChildren) {
      if (used.has(candidate) || nodeKeyOf(candidate) !== key) continue;
      if (seen === ordinal) { matched = candidate; break; }
      seen += 1;
    }
    if (matched) { used.add(matched); ok = syncRenderedNode(child, matched) || ok; }
  }
  return ok;
}

function syncIncludeContent(targetRoot, source) {
  return syncOrdinalChildren(targetRoot, source);
}

/**
 * 增量 reconcile：优先走 Kniu-Diff 的局部补丁（只改文本/属性/增删的节点），
 * 仅当补丁不可收敛（结构剧烈变化、include 宿主内容变化等）时返回 false，
 * 由调用方回退 innerHTML 全量重写。
 */
function reconcileRefreshView(scope, html) {
  try {
    if (!scope || !scope.childNodes) return false;
    return patchRenderedScope(scope, html).ok;
  } catch {
    return false;
  }
}

export const hooks = Object.freeze({});

const ROUTER_BASE_CSS = [
  '.kniu-mount-hidden{visibility:hidden!important}',
  '.kniu-view-coexist{position:absolute;top:0;left:0;width:100%}',
  '.kniu-route-error{padding:10px 20px;line-height:1.6}'
].join('\n');
const ROUTER_STYLE_KEY = 'kniu-router';
function installRouterBaseStyle() {
  if (typeof document === 'undefined' || !document.head) return null;
  const existing = document.head.querySelector(`style[data-kniu-runtime-style="${ROUTER_STYLE_KEY}"]`);
  if (existing) return existing;
  const style = document.createElement('style');
  style.setAttribute('data-kniu-runtime-style', ROUTER_STYLE_KEY);
  const nonce = scopeGet('__KNIU_CSP_NONCE__');
  if (nonce) style.nonce = String(nonce);
  style.textContent = ROUTER_BASE_CSS;
  const pattern = getContracts().paths?.webCssPattern
    || /\/public\/static\/css\/web(?:\.[a-f0-9]+)?\.min\.css$/i;
  const webStyle = [...document.head.querySelectorAll('link[rel="stylesheet"]')]
    .find((link) => pattern.test(link.pathname));
  if (webStyle) document.head.insertBefore(style, webStyle.nextSibling);
  else document.head.appendChild(style);
  trackRuntimeNode(style);
  return style;
}
installRouterBaseStyle();

export function createRouter({ root, routes, data = () => ({}), actions = {}, hooks: customHooks = {}, views = {}, loading = true, request: providedRequest = null, paths = {}, defaultTitle = '' }) {
  root = (root && typeof root.querySelector === 'function' ? root.querySelector('kniu-router-view') : null) || root;
  if (root === document.documentElement) {
    root = document.querySelector('kniu-router-view') || document.body || root;
  }
  root?.removeAttribute('style');
  if (typeof location !== 'undefined' && typeof history !== 'undefined' && history.replaceState) {
    const cfg = getContracts().router || {};
    if (cfg.mode !== 'history') {
      const expected = String(cfg.base || '').replace(/\/$/, '') || '/';
      if (location.pathname !== expected) {
        history.replaceState(history.state, '', expected + location.search + location.hash);
      }
    }
  }
  const request = providedRequest || createRequest();
  const routerHooks = { ...hooks, ...customHooks };
  let templates = {};
  let manifestUrl = '';
  const flattenedRoutes = {};
  const routePairs = (entries) => Array.isArray(entries)
    ? entries.map((route) => [route?.path, route])
    : Object.entries(entries || {});
  const flattenRoutes = (entries, parent = '', ancestors = []) => routePairs(entries).forEach(([path, route]) => {
    if (!route || typeof route !== 'object' || typeof path !== 'string' || !path) {
      throw new TypeError('路由项必须是带 path 的对象，或以路径为键的对象。');
    }
    const fullPath = parent ? `${parent.replace(/\/$/, '')}/${path.replace(/^\//, '')}`.replace(/\/+/g, '/') : (path.startsWith('/') ? path : `/${path}`);
    flattenedRoutes[fullPath] = { ...route, path: fullPath, matched: [...ancestors, fullPath] };
    if (route.children) flattenRoutes(route.children, fullPath, [...ancestors, fullPath]);
  });
  flattenRoutes(routes);
  const routeTable = flattenedRoutes;
  const routeEntries = Object.entries(routeTable).map(([path, route]) => {
    const keys = [];
    const segments = path.split('/').slice(1);
    const source = segments.map((segment) => {
      const dynamic = /^:([A-Za-z_$][\w$]*)$/.exec(segment);
      if (dynamic) {
        keys.push(dynamic[1]);
        return '([^/]+)';
      }
      return segment === '*' ? '(.*)' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    return { path, route, keys, matcher: new RegExp(`^/${source}$`), staticSegments: segments.filter((segment) => !segment.startsWith(':') && segment !== '*').length, dynamicSegments: keys.length };
  }).sort((left, right) => right.staticSegments - left.staticSegments || left.dynamicSegments - right.dynamicSegments || right.path.length - left.path.length);
  const defaultPath = Object.entries(routeTable).find(([, route]) => route.default)?.[0] || Object.keys(routeTable)[0] || '/';
  const routerContracts = () => getContracts().router || {};
  const routeMode = () => (routerContracts().mode === 'history' ? 'history' : 'hash');
  const separator = () => routeSeparator(routeMode());
  const unknownRouteMode = () => (routerContracts().unknownRoute === 'block' ? 'block' : 'home');
  const scrollBehavior = () => {
    const value = routerContracts().scrollBehavior;
    return value === 'restore' || value === 'manual' ? value : 'top';
  };
  const layoutContainerSelector = () => routerContracts().layoutContainerSelector || '';

  let currentPath = defaultPath;
  const controllers = new Map();
  const controllerInstances = new Map();
  const controllerSubscriptions = new Map();
  const controllerFactoryContexts = new Map();
  const mountedControllers = new Set();
  let activeController = null;
  let pendingNavigation = 0;
  let renderQueued = false;
  let refreshRenderTimer = 0;
  const routeState = reactive({ snapshot: { path: defaultPath, params: {}, query: new URLSearchParams() } });
  const mountStates = new Map();
  const mountHidden = createMountHidden();
  const binder = createBinder({
    actions,
    onLinkClick: (href, event, node) => {
      const internal = typeof routerContracts().isInternalLink === 'function'
        ? routerContracts().isInternalLink(href, routeMode(), getContracts())
        : href.startsWith(`${separator()}/`);
      if (!internal) return false;
      if (node.hasAttribute('target') || node.hasAttribute('download')) return false;
      navigate(href);
      return true;
    },
    submissionKey: (node, name) => `${routePath()}:${name}`
  });
  const collectTextBindings = binder.collectTextBindings;
  const patchTextBindings = binder.patchTextBindings;
  const mountTree = (scope, model) => mountViewTree(scope, model, binder.bind).then((result) => {
    void hydrateExternalImages(scope);
    return result;
  });
  const staticTemplateSet = new Set(globalThis.__VIEW_STATIC_TEMPLATES__ || []);
  const staticRenderCache = new Map();
  const DYNAMIC_SOURCE_RE = /\{\{|:[A-Za-z][\w-]*(?:\.[\w-]+)*\s*=/;
  const renderTracked = (source, model, options) => {
    const scopeKey = options?.scopeKey || '';
    const cacheable = Boolean(scopeKey) && staticTemplateSet.has(scopeKey) && !DYNAMIC_SOURCE_RE.test(source);
    if (cacheable && staticRenderCache.has(source)) return Promise.resolve(staticRenderCache.get(source));
    return renderViewHtml(source, model, options).then((html) => {
      binder.recordRenderedHtml(html, routePath(), source);
      if (cacheable) staticRenderCache.set(source, html);
      return html;
    });
  };
  const setSuppress = (value) => binder.setSuppressRender(value);
  globalThis.addEventListener?.('kniu:state-restored', () => {
    try {
      binder.setModel(lastModel);
      patchTextBindings();
      if (currentViewRoot?.isConnected) binder.patchAttrBindings(currentViewRoot, lastModel);
    } catch (error) {
      kniuWarn(KNDEBUG.RUNTIME, '[kniu-devtools] 状态回放刷新失败：', error);
    }
  });

  let hasRendered = false;
  function scheduleRefreshRender() {
    if (refreshRenderTimer) return;
    const scheduledPath = routePath();
    refreshRenderTimer = setTimeout(() => {
      refreshRenderTimer = 0;
      renderQueued = false;
      if (routePath() !== scheduledPath || (hasRendered && currentPath !== scheduledPath)) return;
      const settling = Array.from(mountStates.values()).some((state) => state && state.mounting);
      if (settling) return;
      renderWithBoundary({ refresh: true });
    }, limitValue('refreshDebounceWait', 150));
  }
  let lastModel = {};
  let lastExpandedSource = '';
  let lastScopeKey = '';
  let regionQueue = Promise.resolve();
  let currentViewRoot = null;
  let currentLayout = null;
  const viewTagFor = (resolvedTemplate) => {
    const rel = String(resolvedTemplate || '')
      .replace(new RegExp(`^${templateBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '')
      .replace(/\.html$/i, '')
      .replace(/\//g, '-');
    return ('Kniu-Client-' + rel).toLowerCase();
  };
  const guards = { beforeEach: [], afterEach: [] };
  const loadingEnabled = () => loading !== false;
  const clientPath = (value, label) => {
    const normalized = String(value || '').replaceAll('\\', '/').replace(/^\/+/, '');
    if (!normalized || normalized.split('/').includes('..')) throw new Error(`无效${label}路径：${value}`);
    return normalized;
  };
  const runtimePaths = getContracts().paths;
  const templateBase = String(paths.templates || runtimePaths.templates).replace(/\/?$/, '/');
  const controllerBase = String(paths.controllers || runtimePaths.controllers).replace(/\/?$/, '/');
  const templateUrl = (value) => `${templateBase}${clientPath(value, '模板')}`;
  const controllerUrl = (value) => `${controllerBase}${clientPath(value, '控制器')}`;
  const normalize = (value) => {
    const path = String(value || '').replace(/^#/, '').split(/[?#]/, 1)[0] || '/';
    return path.length > 1 ? path.replace(/\/$/, '') : path;
  };
  const routePath = () => normalize(routeFromLocation(location, getContracts(), defaultPath) || defaultPath);
  const hrefFor = (path) => routeHref(path, getContracts());
  const writeLocation = (path) => {
    const target = hrefFor(path);
    if (routeMode() === 'history') {
      if (`${location.pathname}${location.search}` === target) return false;
      history.pushState(history.state, '', target);
      return true;
    }
    if (location.hash === target) return false;
    location.hash = target;
    return true;
  };

  const canonicalPaths = new Set();
  const canonicalizePath = (path) => {
    const value = normalize(path);
    if (!value) return false;
    if (value !== normalize(currentPath)) return false;
    if (canonicalPaths.has(value)) return false;
    const target = hrefFor(value);
    if (routeMode() === 'history') {
      history.replaceState(history.state, '', target);
    } else if (value === defaultPath) {
      if (!location.hash) return false;
      history.replaceState(history.state, '', location.pathname + location.search);
    } else {
      history.replaceState(history.state, '', target);
    }
    canonicalPaths.add(value);
    return true;
  };

  const resolveTarget = (path, params = {}) => normalize(path).replace(/:([A-Za-z_$][\w$]*)/g, (_, key) => {
    if (params[key] === undefined || params[key] === null) throw new Error(`路由参数缺失：${key}`);
    return encodeURIComponent(params[key]);
  });
  const isPlaceholderSegment = (segment) => /^:([A-Za-z_$][\w$]*)$/.test(segment);
  const resolveRoutePattern = (rawPath, params) => {
    const inputSegments = normalize(rawPath).split('/').slice(1);
    if (!inputSegments.length || inputSegments.some(isPlaceholderSegment)) return null;
    return Object.keys(routeTable).find((pattern) => {
      const patternSegments = pattern.split('/').slice(1);
      if (patternSegments.length <= inputSegments.length) return false;
      for (let i = 0; i < inputSegments.length; i += 1) {
        if (isPlaceholderSegment(patternSegments[i]) || patternSegments[i] !== inputSegments[i]) return false;
      }
      const rest = patternSegments.slice(inputSegments.length);
      return rest.every((segment) => {
        const key = segment.slice(1);
        return isPlaceholderSegment(segment) && params[key] !== undefined && params[key] !== null;
      });
    }) || null;
  };

  const buildContext = (path, rawTarget, from) => {
    const target = normalize(path);
    const matched = routeEntries.find((entry) => entry.matcher.test(target));
    const resolved = matched?.path || defaultPath;
    const route = routeTable[resolved] || {};
    const values = matched?.matcher.exec(target)?.slice(1) || [];
    const keys = matched?.keys || [];
    const safeDecode = (raw) => { try { return decodeURIComponent(raw); } catch { return raw; } };
    const params = Object.fromEntries(keys.map((key, index) => [key, safeDecode(values[index] || '')]));
    const query = new URLSearchParams((String(rawTarget || target).split('?')[1] || '').split('#', 1)[0]);
    return { to: target, from, route, params, matched: route.matched, query };
  };

  const controllerKeyFor = (path) => {
    const matchedEntry = routeEntries.find((entry) => entry.matcher.test(normalize(path)));
    const resolved = matchedEntry?.path || defaultPath;
    const target = routeTable[resolved] || {};
    if (!target.controller) return null;
    return typeof target.controller === 'string' ? controllerUrl(target.controller) : `${resolved}:lazy`;
  };

  const runGuards = async (context) => {
    for (const guard of [...guards.beforeEach, context.route?.beforeEnter].filter(Boolean)) {
      if (await guard(context) === false) return false;
    }
    if (typeof routerHooks.beforeEach === 'function' && await routerHooks.beforeEach(context) === false) return false;
    return true;
  };

  const navigateGuarded = async (rawTarget, options = {}) => {
    const before = routePath();
    const context = buildContext(rawTarget, rawTarget, currentPath);
    const allowed = await runGuards(context);
    if (!allowed) {
      if (routePath() !== before && hasRendered) return;
      return;
    }
    if (routePath() !== before) return;
    const changed = writeLocation(rawTarget);
    if (!changed) renderWithBoundary({ showLoading: options.loading !== false });
  };

  const navigate = (path, params = {}, options = {}) => {
    const rawPath = String(path || '');
    let pattern, target, resolvedPath;
    try {
      pattern = resolveRoutePattern(rawPath, params) || rawPath;
      const usedParams = new Set([...pattern.matchAll(/:([A-Za-z_$][\w$]*)/g)].map((match) => match[1]));
      const query = new URLSearchParams((rawPath.split('?')[1] || '').split('#', 1)[0]);
      Object.entries(params || {}).forEach(([key, value]) => {
        if (!options.state && !usedParams.has(key) && value != null) query.set(key, String(value));
      });
      resolvedPath = resolveTarget(pattern, params);
      target = resolvedPath + (query.size ? `?${query}` : '');
    } catch (e) {
      kniuWarn(KNDEBUG.ROUTER, 'navigate 参数缺失，fallback 到 query 形式：' + e.message);
      const query = new URLSearchParams(Object.entries(params || {}).map(([k, v]) => [k, String(v)]));
      resolvedPath = normalize(rawPath);
      target = rawPath + (query.size ? `?${query}` : '');
    }
    const quiet = options.loading === false;
    if (target === defaultPath) {
      if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
      renderWithBoundary({ showLoading: !quiet });
      return;
    }
    const currentHref = routeMode() === 'history'
      ? `${location.pathname}${location.search}`
      : (location.hash.slice(1) || defaultPath);
    if (currentHref === target) {
      if (options.state) history.replaceState({ ...history.state, kniuRouteData: { path: resolvedPath, data: params } }, '');
      renderWithBoundary({ showLoading: !quiet });
      return;
    }
    void navigateGuarded(target, { state: options.state, loading: options.loading }).then(() => {
      if (!options.state || routePath() !== resolvedPath) return;
      history.replaceState({ ...history.state, kniuRouteData: { path: resolvedPath, data: params } }, '');
    }, () => { });
  };
  const beforeEach = (guard) => { if (typeof guard !== 'function') throw new TypeError('beforeEach 需要函数'); guards.beforeEach.push(guard); return () => guards.beforeEach.splice(guards.beforeEach.indexOf(guard), 1); };
  const afterEach = (hook) => { if (typeof hook !== 'function') throw new TypeError('afterEach 需要函数'); guards.afterEach.push(hook); return () => guards.afterEach.splice(guards.afterEach.indexOf(hook), 1); };
  const getRouteSnapshot = () => routeState.snapshot;

  function updateBindings(scope, mutate) {
    const scopes = Array.isArray(scope) ? [...new Set(scope)] : [scope];
    if (!scopes.length || scopes.some((element) => !element?.isConnected) || typeof mutate !== 'function') throw new TypeError('updateBindings 需要已挂载的元素和同步更新函数');
    const previousSuppress = binder.suppressRender;
    setSuppress(true);
    try {
      mutate();
      scopes.forEach((element) => collectTextBindings(element, false));
      patchTextBindings();
      scopes.forEach((element) => binder.bind(lastModel, element, true));
    } finally {
      setSuppress(previousSuppress);
    }
  }
  function refreshRegion(name, mutate) {
    const navigation = pendingNavigation;
    const viewRoot = currentViewRoot;
    const run = regionQueue.then(() => {
      if (navigation !== pendingNavigation || viewRoot !== currentViewRoot) return;
      return performRegionRefresh(name, mutate);
    });
    regionQueue = run.catch(() => { });
    return run;
  }
  async function performRegionRefresh(name, mutate) {
    if (!lastExpandedSource || !currentViewRoot) return;
    const viewRoot = currentViewRoot;
    const navigation = pendingNavigation;
    const selector = '[data-kniu-region="' + String(name).replace(/"/g, '\\"') + '"]';
    const current = currentViewRoot.querySelector(selector);
    if (!current) return;
    const previousSuppress = binder.suppressRender;
    setSuppress(true);
    try {
      if (typeof mutate === 'function') await mutate();
      if (navigation !== pendingNavigation || viewRoot !== currentViewRoot || !current.isConnected) return;
      const html = renderTemplate(lastExpandedSource, lastModel, { collect: true, scopeKey: lastScopeKey });
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const findRegion = (scope) => {
        const found = scope.querySelector(selector);
        if (found) return found;
        for (const template of scope.querySelectorAll('template')) {
          const nested = findRegion(template.content);
          if (nested) return nested;
        }
        return null;
      };
      const fresh = findRegion(doc);
      if (!fresh) return;
      const replacement = document.importNode(fresh, true);
      if (current.hasAttribute('slot') && !replacement.hasAttribute('slot')) replacement.setAttribute('slot', current.getAttribute('slot'));
      const previousVisibility = replacement.style.getPropertyValue('visibility');
      const previousPriority = replacement.style.getPropertyPriority('visibility');
      replacement.style.setProperty('visibility', 'hidden', 'important');
      current.replaceWith(replacement);
      try {
        collectTextBindings(replacement, false);
        await mountTree(replacement, lastModel);
        collectRefs(currentViewRoot, lastModel.refs);
      } finally {
        if (previousVisibility) replacement.style.setProperty('visibility', previousVisibility, previousPriority);
        else replacement.style.removeProperty('visibility');
        pruneEmptyAttributes(replacement);
      }
    } finally {
      setSuppress(previousSuppress);
    }
  }

  async function expandIncludes(source, fileUrl, ancestors = [], scope = {}, includeModels = []) {
    const includePattern = /<include\s+src\s*=\s*(["'])(.*?)\1\s*\/\s*>/gi;
    const matches = [...source.matchAll(includePattern)];
    let output = source;
    for (const match of matches) {
      const includeUrl = new URL(match[2], `http://kniu.local${fileUrl}`).pathname;
      if (!includeUrl.startsWith(templateBase) || ancestors.includes(includeUrl)) throw new Error(`无效或循环 include：${includeUrl}`);
      const includeSource = templates[includeUrl];
      if (includeSource === undefined) throw new Error(`include 模板不存在：${includeUrl}`);
      const nested = await expandIncludes(includeSource, includeUrl, [...ancestors, includeUrl], scope, includeModels);
      const controllerPath = views[includeUrl.slice(templateBase.length)];
      let rendered = nested;
      if (controllerPath) {
        const url = controllerUrl(controllerPath);
        const module = controllers.get(url) || (await import(url));
        controllers.set(url, module);
        const factory = module.default || module;
        const includeKey = `include:${includeUrl}`;
        let model = controllerInstances.get(includeKey);
        if (!model) {
          model = typeof factory === 'function' ? await factory({ include: includeUrl, request, navigate, getRoute: getRouteSnapshot }) || {} : factory || {};
          controllerInstances.set(includeKey, model);
        }
        if (model && typeof model.__kniuSyncRoute === 'function') {
          const previousSuppress = binder.suppressRender;
          binder.setSuppressRender(true);
          try { await model.__kniuSyncRoute({ path: routePath() }); }
          finally { binder.setSuppressRender(previousSuppress); }
        }
        if (model && typeof model === 'object') {
          includeModels.push(model);
          const previousIncludeSubscription = controllerSubscriptions.get(includeKey);
          if (typeof previousIncludeSubscription === 'function') previousIncludeSubscription();
          controllerSubscriptions.set(includeKey, model.__kniuSubscribe?.(() => {
            if (activeController && !root.isConnected) return;
            if (routePath() !== currentPath) return;
            if (binder.suppressRender) {
              patchTextBindings();
              binder.patchAttrBindings(root, model);
              return;
            }
            if (renderQueued) return;
            renderQueued = true;
            scheduleRefreshRender();
          }) || null);
        }
        rendered = renderTemplate(nested, { ...scope, ...model }, { scopeKey: includeUrl });
      }
      const includeTag = viewTagFor(includeUrl);
      output = output.replace(match[0], () => `<${includeTag} data-kniu-view-host="${includeUrl}">${rendered}</${includeTag}>`);
    }
    return output;
  }

  function composeLayout(layoutExpanded, viewHtml, layoutUrl) {
    const composed = composeLayoutIn(layoutExpanded, viewHtml);
    if (composed !== null) return composed;
    if (layoutExpanded.includes('%%KNIU_S_')) {
      const restored = restoreStaticBlocks(layoutExpanded);
      if (restored !== layoutExpanded) {
        const retried = composeLayoutIn(restored, viewHtml);
        if (retried !== null) return retried;
      }
    }
    const selector = layoutContainerSelector();
    if (selector) throw new Error(`布局兜底容器未命中：${layoutUrl} 中找不到 ${selector}`);
    throw new Error(`布局缺少路由槽位：${layoutUrl}（应含 <kniu-router-view> 或 data-kniu-layout，也可用 contracts.router.layoutContainerSelector 配置兜底容器）`);
  }

  function composeLayoutIn(layoutExpanded, viewHtml) {
    const markedSlot = /<([\w-]+)([^>]*\bdata-kniu-layout\b[^>]*?)(\/?)>(?:[\s\S]*?<\/\1\s*>)?/i.exec(layoutExpanded);
    if (markedSlot) {
      const openTag = markedSlot[1];
      const attributes = markedSlot[2].replace(/\s*\/$/, '');
      return layoutExpanded.replace(markedSlot[0], `<${openTag}${attributes}>${viewHtml}</${openTag}>`);
    }
    const routerViewSlot = /<kniu-router-view\b[^>]*>(?:[\s\S]*?<\/kniu-router-view\s*>)?/i.exec(layoutExpanded);
    if (routerViewSlot) {
      return layoutExpanded.replace(routerViewSlot[0], viewHtml);
    }
    const selector = layoutContainerSelector();
    if (!selector) return null;
    const className = selector.replace(/^[.#]/, '');
    const pattern = new RegExp(`<([\\w-]+)([^>]*\\bclass\\s*=\\s*["'][^"']*${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*["'][^>]*)>[\\s\\S]*?<\\/\\1\\s*>`, 'i');
    if (!pattern.test(layoutExpanded)) return null;
    return layoutExpanded.replace(pattern, (_, tag, attributes) => `<${tag}${attributes}>${viewHtml}</${tag}>`);
  }

  function renderPageNotFound(to) {
    const viewTag = 'kniu-client-routemissing';
    if (root.firstElementChild && root.firstElementChild.localName === viewTag && hasRendered) return;
    const host = document.createElement(viewTag);
    host.setAttribute('data-kniu-route-view', '');
    const viewRoot = ensureShadowRoot(host);
    viewRoot.innerHTML = '<section class="kniu-route-error" role="alert"><h1>页面不存在</h1><p>地址可能有误，或该页面已被移除。</p><a href="#/" data-kniu-home>返回首页</a></section>';
    root.replaceChildren(host);
    currentViewRoot = viewRoot;
    hasRendered = true;
    activeController = null;
    currentPath = to;
    routeState.snapshot = { path: to, params: {}, query: new URLSearchParams() };
    viewRoot.querySelector('[data-kniu-home]')?.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(defaultPath);
    });
    updateHead({ title: '页面不存在', description: '', canonical: `${location.origin}${location.pathname}` });
  }

  async function render(refreshMode = false) {
    const from = currentPath;
    const to = routePath();
    const isNavigation = !hasRendered || to !== from;
    if (isNavigation) {
      const doc = globalThis.document?.documentElement;
      if (doc) {
        const prevBehavior = doc.style.scrollBehavior;
        doc.style.scrollBehavior = 'auto';
        doc.scrollTop = 0;
        doc.style.scrollBehavior = prevBehavior || '';
      }
      const body = globalThis.document?.body;
      if (body) body.scrollTop = 0;
    }
    const navigationId = ++pendingNavigation;
    kniuDebug(KNDEBUG.ROUTER, 'navigate start', { to, from, isNavigation, refreshMode });
    const matched = routeEntries.find((entry) => entry.matcher.test(to));
    const blocked = !matched && unknownRouteMode() === 'block';
    const context = buildContext(to, to, from);
    const route = blocked ? {} : (routeTable[matched?.path || defaultPath] || {});
    const { params } = context;
    const rerenderScroll = to === from && !isNavigation ? window.scrollY : null;
    if (isNavigation) {
      if (!await runGuards(context)) return;
      if (navigationId !== pendingNavigation) return;
    }
    if (blocked) {
      renderPageNotFound(to);
      if (typeof routerHooks.afterEach === 'function') await routerHooks.afterEach(context);
      for (const hook of guards.afterEach) await hook(context);
      return;
    }
    const resolvedPath = matched?.path || defaultPath;
    const resolvedTemplatePath = resolvedPath;
    const nextControllerKey = route.controller ? controllerUrl(route.controller) : null;
    const sameController = Boolean(nextControllerKey && nextControllerKey === activeController && hasRendered);
    if (activeController && activeController !== nextControllerKey) {
      const previousInstance = controllerInstances.get(activeController);
      await previousInstance?.__kniuLifecycle?.beforeUnmount?.({ root: currentViewRoot, context });
      await previousInstance?.__kniuLifecycle?.unmounted?.({ root: currentViewRoot, context });
      const previousSubscription = controllerSubscriptions.get(activeController);
      if (typeof previousSubscription === 'function') {
        previousSubscription();
        controllerSubscriptions.delete(activeController);
      }
      mountedControllers.delete(activeController);
    }
    if (typeof routerHooks.beforeLoad === 'function') await routerHooks.beforeLoad(context);
    if (!refreshMode) request.beginRequestTracking();
    routeState.snapshot = { path: to, params: { ...params }, query: new URLSearchParams((location.hash.split('?')[1] || '').split('#', 1)[0]) };
    kniuDebug(KNDEBUG.RUNTIME, 'routeState synced', { path: routeState.snapshot.path, params: routeState.snapshot.params });
    let controllerData = {};
    let controllerInstance;
    if (route.controller) {
      const controllerDefinition = typeof route.controller === 'function' ? route.controller : () => import(controllerUrl(route.controller));
      const url = typeof route.controller === 'string' ? controllerUrl(route.controller) : `${resolvedPath}:lazy`;
      controllerInstance = controllerInstances.get(url);
      if (!controllerInstance) {
        const controller = controllers.get(url) || await controllerDefinition();
        controllers.set(url, controller);
        const factory = controller.default || controller;
        if (typeof factory === 'function') {
          const factoryContext = { ...context, request, navigate, refreshRegion, updateBindings, getRoute: getRouteSnapshot, getHref: hrefFor, canonicalize: canonicalizePath, controllerKey: nextControllerKey, resolveControllerKey: controllerKeyFor };
          controllerFactoryContexts.set(url, factoryContext);
          kniuDebug(KNDEBUG.RUNTIME, 'controller setup', { url, params });
          controllerInstance = await factory(factoryContext) || {};
          kniuDebug(KNDEBUG.RUNTIME, 'controller setup done', { url });
        } else {
          controllerInstance = factory || {};
        }
        controllerInstances.set(url, controllerInstance);
      } else {
        const factoryContext = controllerFactoryContexts.get(url);
        if (factoryContext) {
          factoryContext.params = { ...params };
          factoryContext.route = route;
          factoryContext.query = context.query;
          factoryContext.to = to;
          factoryContext.from = from;
        }
      }
      controllerData = controllerInstance;
      if (nextControllerKey && !controllerSubscriptions.has(nextControllerKey)) {
        mountStates.set(nextControllerKey, { mounting: true, changed: false });
        controllerSubscriptions.set(nextControllerKey, controllerInstance.__kniuSubscribe?.(() => {
          const mountState = mountStates.get(nextControllerKey);
          if (mountState?.mounting) { mountState.changed = true; return; }
          if (activeController !== nextControllerKey) return;
          if (binder.suppressRender) { patchTextBindings(); return; }
          if (controllerInstance.__kniuRenderMode === 'text') {
            patchTextBindings();
            return;
          }
          const source = binder.lastRenderedSource();
          if (!source) { scheduleRefreshRender(); return; }
          renderViewHtml(source, lastModel, { collect: false, scopeKey: lastScopeKey }).then((html) => {
            if (activeController !== nextControllerKey || routePath() !== currentPath) return;
            if (binder.renderedHtmlMatches(html, routePath())
              || (typeof binder.structuralHtmlMatches === 'function' && binder.structuralHtmlMatches(html, routePath()))) {
              patchTextBindings();
              if (currentViewRoot?.isConnected) binder.patchAttrBindings(currentViewRoot, lastModel);
              return;
            }
            if (renderQueued) return;
            renderQueued = true;
            scheduleRefreshRender();
          }).catch(() => {
            if (renderQueued) return;
            renderQueued = true;
            scheduleRefreshRender();
          });
        }) || null);
      }
    }
    const templateValue = typeof route.template === 'function' ? await route.template(context) : route.template;
    const resolvedTemplate = templateUrl(templateValue);
    const source = templates[resolvedTemplate];
    if (!source) { root.innerHTML = `<p>模板未找到：${escapeHtml(resolvedTemplate)}</p>`; return; }
    if (typeof routerHooks.beforeRender === 'function') await routerHooks.beforeRender(context);
    const includeRoute = { ...route, title: typeof route.title === 'function' ? String(route.title({ model: controllerData, params }) ?? '') : route.title };
    const includeModels = [];
    const expandedSource = await expandIncludes(source, resolvedTemplate, [resolvedTemplate], { route: includeRoute, params }, includeModels);
    let composedSource = expandedSource;
    if (route.layout) {
      const layoutUrl = templateUrl(route.layout);
      const layoutSource = templates[layoutUrl];
      if (layoutSource === undefined) throw new Error(`布局模板不存在：${layoutUrl}`);
      const layoutExpanded = await expandIncludes(layoutSource, layoutUrl, [layoutUrl], { route: includeRoute, params }, includeModels);
      composedSource = composeLayout(layoutExpanded, expandedSource, layoutUrl);
    }
    const model = { ...data(), route, params, navigate };
    const defineModelProperty = function (source, key) {
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      const property = { enumerable: true, configurable: true, get: function () { return source[key]; } };
      if (!descriptor || descriptor.set || descriptor.writable) property.set = function (value) { source[key] = value; };
      Object.defineProperty(model, key, property);
    };
    includeModels.forEach(function (source) {
      if (!source || typeof source !== 'object') return;
      Object.keys(source).forEach(function (key) { if (key in model) return; defineModelProperty(source, key); });
    });
    Object.keys(controllerData || {}).forEach(function (key) { defineModelProperty(controllerData, key); });
    await controllerInstance?.__kniuLifecycle?.beforeMount?.({ root: currentViewRoot, model, context });
    if (navigationId !== pendingNavigation) return;
    const activeEl = (currentViewRoot && currentViewRoot.activeElement)
      ? currentViewRoot.activeElement
      : (root.contains(document.activeElement) ? document.activeElement : null);
    const focusForm = activeEl?.getAttribute('data-kniu-form') || '';
    const focusStart = activeEl && 'selectionStart' in activeEl ? activeEl.selectionStart : null;
    const focusEnd = activeEl && 'selectionEnd' in activeEl ? activeEl.selectionEnd : null;
    lastModel = model;
    binder.setModel(model);
    lastExpandedSource = composedSource;
    lastScopeKey = resolvedTemplate;
    const settleFirstScreen = async (rerender) => {
      if (!controllerInstance || !nextControllerKey || mountedControllers.has(nextControllerKey)) return;
      if (navigationId !== pendingNavigation) return;
      mountedControllers.add(nextControllerKey);
      const pendingMountState = mountStates.get(nextControllerKey);
      mountStates.set(nextControllerKey, { mounting: true, changed: Boolean(pendingMountState?.changed) });
      request.beginRequestTracking();
      try {
        await controllerInstance?.__kniuLifecycle?.mounted?.({ root: currentViewRoot, model, context });
      } catch (error) {
        kniuError(KNDEBUG.ROUTER, '控制器 mounted 钩子失败：', error);
      }
      kniuDebug(KNDEBUG.RUNTIME, 'controller mounted done', { key: nextControllerKey });
      await request.requestTrackingSettled(limitValue('requestTrackingTimeout', 16_000));
      if (navigationId !== pendingNavigation) {
        mountedControllers.delete(nextControllerKey);
        mountStates.delete(nextControllerKey);
        return;
      }
      const mountState = mountStates.get(nextControllerKey);
      const changed = Boolean(mountState?.changed);
      if (mountState) { mountState.mounting = false; mountState.changed = false; }
      if (refreshRenderTimer) {
        clearTimeout(refreshRenderTimer);
        refreshRenderTimer = 0;
        renderQueued = false;
      }
      if (typeof rerender === 'function' && controllerInstance.__kniuRenderMode !== 'text') await rerender();
    };
    const existingTarget = route.layout && route.layout === currentLayout && route.loadingTarget
      ? currentViewRoot?.querySelector(route.loadingTarget) : null;
    let viewRoot;
    let host = null;
    if (existingTarget) {
      viewRoot = currentViewRoot;
      const layoutDocument = new DOMParser().parseFromString(
        renderTemplate(composedSource, model, { collect: true, scopeKey: resolvedTemplate }), 'text/html'
      );
      const layoutHosts = [...viewRoot.querySelectorAll('[data-kniu-view-host]')];
      for (const previousHost of layoutHosts) {
        if (existingTarget.contains(previousHost)) continue;
        const source = [...layoutDocument.querySelectorAll('[data-kniu-view-host]')]
          .find((candidate) => candidate.getAttribute('data-kniu-view-host') === previousHost.getAttribute('data-kniu-view-host'));
        if (!source) { previousHost.remove(); continue; }
        if (previousHost.shadowRoot && typeof previousHost.__kniuIncludeHtml === 'string'
          && stableIncludeHtml(previousHost.__kniuIncludeHtml) === stableIncludeHtml(source.innerHTML)
          && syncIncludeContent(previousHost.shadowRoot, source)) {
          binder.bind(model, previousHost.shadowRoot, true);
          collectRefs(viewRoot, model.refs);
          continue;
        }
        const replacement = document.importNode(source, true);
        const previousVisibility = replacement.style.getPropertyValue('visibility');
        const previousPriority = replacement.style.getPropertyPriority('visibility');
        replacement.style.setProperty('visibility', 'hidden', 'important');
        previousHost.replaceWith(replacement);
        try {
          collectTextBindings(replacement, false);
          await mountTree(replacement, model);
          collectRefs(viewRoot, model.refs);
        } finally {
          if (previousVisibility) replacement.style.setProperty('visibility', previousVisibility, previousPriority);
          else replacement.style.removeProperty('visibility');
          pruneEmptyAttributes(replacement);
        }
      }
      currentPath = to;
      routeState.snapshot = { ...routeState.snapshot, path: to };
      hasRendered = true;
      activeController = nextControllerKey;
      await mountHidden.run(existingTarget, async () => {
        const refreshedHtml = await renderTracked(expandedSource, model, { collect: true, scopeKey: resolvedTemplate });
        if (!(refreshMode && reconcileRefreshView(existingTarget, refreshedHtml))) {
          wipePreservingOverlays(existingTarget, refreshedHtml);
          collectTextBindings(existingTarget);
        }
        await mountTree(existingTarget, model);
        collectRefs(viewRoot, model.refs);
      });
      await settleFirstScreen(async () => {
        await mountHidden.run(existingTarget, async () => {
          const settledHtml = await renderTracked(expandedSource, model, { collect: true, scopeKey: resolvedTemplate });
          if (!reconcileRefreshView(existingTarget, settledHtml)) {
            wipePreservingOverlays(existingTarget, settledHtml);
            collectTextBindings(existingTarget);
          }
          await mountTree(existingTarget, model);
          collectRefs(viewRoot, model.refs);
        });
      });
    } else {
      const viewTag = viewTagFor(resolvedTemplate);
      const existingHost = root.firstElementChild;
      if (!isNavigation && existingHost && existingHost.localName === viewTag) {
        host = existingHost;
        viewRoot = ensureShadowRoot(existingHost);
        currentViewRoot = viewRoot;
        await mountHidden.run(existingHost, async () => {
          const refreshedHtml = await renderTracked(composedSource, model, { collect: true, scopeKey: resolvedTemplate });
          if (!(refreshMode && reconcileRefreshView(viewRoot, refreshedHtml))) {
            viewRoot.innerHTML = refreshedHtml;
            recordIncludeSnapshots(viewRoot);
          }
          await syncGlobalStyles(existingHost);
          collectTextBindings(viewRoot);
          await mountTree(viewRoot, model);
          collectRefs(viewRoot, model.refs);
          await settleFirstScreen(async () => {
            const settledHtml = await renderTracked(composedSource, model, { collect: true, scopeKey: resolvedTemplate });
            if (!reconcileRefreshView(viewRoot, settledHtml)) {
              viewRoot.innerHTML = settledHtml;
              recordIncludeSnapshots(viewRoot);
            }
            await syncGlobalStyles(existingHost);
            collectTextBindings(viewRoot);
            await mountTree(viewRoot, model);
            collectRefs(viewRoot, model.refs);
          });
        });
      } else {
        host = document.createElement(viewTag);
        host.setAttribute('data-kniu-route-view', '');
        viewRoot = ensureShadowRoot(host);
        const freshHtml = await renderTracked(composedSource, model, { collect: true, scopeKey: resolvedTemplate });
        const prerenderShell = !hasRendered ? root.querySelector('[data-kniu-prerender]') : null;
        const hydratable = Boolean(prerenderShell) && prerenderShell.getAttribute('data-kniu-path') === resolvedPath;
        viewRoot.innerHTML = hydratable ? prerenderShell.innerHTML : freshHtml;
        await syncGlobalStyles(host);
        recordIncludeSnapshots(viewRoot);
        if (hydratable && !reconcileRefreshView(viewRoot, freshHtml)) viewRoot.innerHTML = freshHtml;
        if (navigationId !== pendingNavigation) return;
        const previousHost = root.firstElementChild;
        const coexist = Boolean(previousHost && previousHost.isConnected && previousHost !== host);
        await mountHidden.run(host, async () => {
          if (coexist) {
            host.classList.add('kniu-view-coexist');
            root.appendChild(host);
          } else {
            root.replaceChildren(host);
          }
          currentViewRoot = viewRoot;
          currentPath = to;
          routeState.snapshot = { ...routeState.snapshot, path: to };
          hasRendered = true;
          activeController = nextControllerKey;
          collectTextBindings(viewRoot);
          await mountTree(viewRoot, model);
          collectRefs(viewRoot, model.refs);
          await settleFirstScreen(async () => {
            const settledHtml = await renderTracked(composedSource, model, { collect: true, scopeKey: resolvedTemplate });
            if (!reconcileRefreshView(viewRoot, settledHtml)) {
              viewRoot.innerHTML = settledHtml;
              recordIncludeSnapshots(viewRoot);
            }
            await syncGlobalStyles(host);
            collectTextBindings(viewRoot);
            await mountTree(viewRoot, model);
            collectRefs(viewRoot, model.refs);
          });
          if (navigationId !== pendingNavigation) {
            if (coexist && host.parentNode === root) host.remove();
            return;
          }
          if (coexist) {
            removeClass(host, 'kniu-view-coexist');
            pruneEmptyAttributes(host);
            Array.from(root.childNodes).forEach((node) => { if (node !== host) node.remove(); });
          }
        });
      }
    }
    if (!refreshMode) {
      await request.requestTrackingSettled(limitValue('requestTrackingTimeout', 16_000));
      if (navigationId !== pendingNavigation) return;
      const mountStatePending = mountStates.get(nextControllerKey);
      if (mountStatePending) { mountStatePending.mounting = false; mountStatePending.changed = false; }
    }
    await settleFirstScreen(async () => {
      const settledHtml = await renderTracked(composedSource, model, { collect: true, scopeKey: resolvedTemplate });
      if (!reconcileRefreshView(viewRoot, settledHtml)) {
        viewRoot.innerHTML = settledHtml;
        recordIncludeSnapshots(viewRoot);
      }
      await syncGlobalStyles(host);
      collectTextBindings(viewRoot);
      await mountTree(viewRoot, model);
      collectRefs(viewRoot, model.refs);
    });
    currentLayout = route.layout || null;
    if (navigationId !== pendingNavigation) return;
    const titleValue = typeof route.title === 'function' ? await route.title({ ...context, model }) : route.title;
    const seo = typeof route.seo === 'function' ? await route.seo({ ...context, model }) : route.seo || {};
    updateHead({
      title: seo.title || titleValue || defaultTitle,
      description: seo.description,
      canonical: seo.canonical || `${location.origin}${location.pathname}${to === defaultPath ? '' : hrefFor(to)}`,
      image: seo.image,
      type: seo.type,
      jsonLd: seo.jsonLd
    });
    collectRefs(viewRoot, model.refs);
    if (navigationId !== pendingNavigation) return;
    if ('scrollRestoration' in history) history.scrollRestoration = scrollBehavior() === 'restore' ? 'auto' : 'manual';
    if (!refreshMode) {
      const restoreScroll = typeof rerenderScroll === 'number' ? rerenderScroll : 0;
      if (!existingTarget) window.scrollTo(0, restoreScroll);
      else if (isNavigation) existingTarget.scrollTop = 0;
    }
    if (focusForm) {
      const restored = viewRoot.querySelector(`[data-kniu-form="${focusForm.replace(/"/g, '\\"')}"]`);
      if (restored) {
        restored.focus({ preventScroll: true });
        if (focusStart != null && typeof restored.setSelectionRange === 'function') restored.setSelectionRange(focusStart, focusEnd ?? focusStart);
      }
    }
    if (navigationId !== pendingNavigation) return;
    if (isNavigation) {
      if (typeof routerHooks.afterEach === 'function') await routerHooks.afterEach(context);
      for (const hook of guards.afterEach) await hook(context);
    }
    if (typeof routerHooks.afterRender === 'function') await routerHooks.afterRender(context);
  }

  let loadingToken = 0;
  const wipePreservingOverlays = (container, html) => {
    const overlays = [...container.querySelectorAll('[data-kniu-preserve]')];
    container.innerHTML = html;
    overlays.forEach((node) => { if (!node.isConnected) container.appendChild(node); });
  };

  async function renderWithBoundary({ refresh = false, showLoading = true } = {}) {
    root.setAttribute('aria-busy', 'true');
    const targetRoute = routeEntries.find((entry) => entry.matcher.test(routePath()));
    const targetConfig = routeTable[targetRoute?.path || defaultPath];
    const crossLayout = Boolean(targetConfig?.layout && targetConfig.layout !== currentLayout);
    const routeLoadingEnabled = !refresh && loadingEnabled()
      && (crossLayout || (showLoading && targetConfig?.showLoading !== false));
    if (!refresh) request.beginRequestTracking();
    const token = ++loadingToken;
    if (routeLoadingEnabled) {
      root.dataset.kniuLoading = 'true';
      const loadingScope = (!crossLayout && currentViewRoot) || root.getRootNode();
      const loadingTargetEl = (targetConfig?.loadingTarget && typeof loadingScope.querySelector === 'function')
        ? (loadingScope.querySelector(targetConfig.loadingTarget) || null) : null;
      showBootLoading({ target: loadingTargetEl });
    }
    let renderError = null;
    const renderStartedAt = performance.now();
    try {
      if (token !== loadingToken) return;
      await render(refresh);
      root.removeAttribute('data-kniu-error');
      kniuDebug(KNDEBUG.RUNTIME, 'page render done', { path: currentPath, refresh });
      recordRoute(currentPath, document.querySelector('[data-kniu-route-view]')?.localName || '', performance.now() - renderStartedAt);
    } catch (error) {
      renderError = error;
      kniuError(KNDEBUG.ROUTER, '页面渲染失败：', error);
      root.dataset.kniuError = 'true';
      const detail = scopeGet('__KNIU_ERROR_DETAIL__') ? String(error?.message || '') : '';
      root.innerHTML = `<section class="kniu-route-error" role="alert"><h1>页面加载失败</h1><p>${escapeHtml(detail || '请稍后重试。')}</p><button type="button" data-kniu-retry>重试</button></section>`;
      root.querySelector('[data-kniu-retry]')?.addEventListener('click', () => { renderWithBoundary(); }, { once: true });
    } finally {
      if (token === loadingToken) {
        root.removeAttribute('aria-busy');
        delete root.dataset.kniuLoading;
        if (routeLoadingEnabled) hideBootLoading();
      }
      if (!refresh) request.requestTrackingSettled(0);
      if (renderError) throw renderError;
    }
  }

  let componentPreloadScheduled = false;
  const scheduleComponentPreload = () => {
    if (componentPreloadScheduled) return;
    componentPreloadScheduled = true;
    queueMicrotask(() => { preloadComponents(); });
  };

  const hmrFileUrl = (file) => '/' + String(file || '')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/^client\//, '');
  let hotTemplateTimer = 0;
  const hotReloadTemplates = async (reason = '') => {
    if (!manifestUrl) return;
    try {
      await import(`${manifestUrl}${manifestUrl.includes('?') ? '&' : '?'}hmr=${Date.now()}`);
      templates = globalThis.__VIEW_TEMPLATES__ || {};
      staticTemplateSet.clear();
      (globalThis.__VIEW_STATIC_TEMPLATES__ || []).forEach((url) => staticTemplateSet.add(url));
      staticRenderCache.clear();
      await renderWithBoundary({ refresh: true });
      globalThis.__hmrLog?.push?.({ t: Math.round(performance.now()), ev: 'tpl-ok', reason, keys: Object.keys(templates).length });
    } catch (error) {
      globalThis.__hmrLog?.push?.({ t: Math.round(performance.now()), ev: 'tpl-err', reason, error: String(error?.message || error) });
      kniuError(KNDEBUG.TEMPLATE, '模板热更新失败，请手动刷新页面：', error);
    }
  };
  const hotApplyWebCss = async (file) => {
    const url = hmrFileUrl(file);
    try {
      const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}hmr=${Date.now()}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const cssText = await response.text();
      const pattern = getContracts().paths?.webCssPattern
        || /\/public\/static\/css\/web(?:\.[a-f0-9]+)?\.min\.css$/i;
      const link = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .find((el) => pattern.test(el.pathname));
      if (link) link.href = `${url}${url.includes('?') ? '&' : '?'}hmr=${Date.now()}`;
      return true;
    } catch (error) {
      kniuWarn(KNDEBUG.ROUTER, '全局 CSS 热更新失败：', error);
      return false;
    }
  };
  const FORM_DRAFT_KEY = '__KNIU_HMR_DRAFTS__';
  function snapshotFormDrafts() {
    try {
      const drafts = [...document.querySelectorAll('input, textarea, select')]
        .filter((el) => el.name && el.type !== 'password' && el.type !== 'file' && String(el.value))
        .map((el) => ({ name: el.name, tag: el.localName, value: el.value }));
      if (drafts.length) sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(drafts));
    } catch { }
  }
  function restoreFormDrafts() {
    try {
      const raw = sessionStorage.getItem(FORM_DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(FORM_DRAFT_KEY);
      const drafts = JSON.parse(raw);
      if (!Array.isArray(drafts)) return;
      const filled = new Set();
      for (const draft of drafts) {
        document.querySelectorAll(`${draft.tag}[name="${CSS.escape(draft.name)}"]`).forEach((el) => {
          if (el.type === 'password' || el.type === 'file' || filled.has(el)) return;
          el.value = draft.value;
          filled.add(el);
        });
      }
    } catch { }
  }
  if (globalThis.__KNIU_HMR_SOURCE__) restoreFormDrafts();

  const installHmrDispatcher = () => {
    if (!globalThis.__KNIU_HMR_SOURCE__ || globalThis.__KNIU_HMR_DISPATCH__) return;
    globalThis.__KNIU_HMR_DISPATCH__ = (events) => {
      const files = (Array.isArray(events) ? events : [])
        .map((item) => String(item?.filename || '').replaceAll('\\', '/'))
        .filter((file) => file && /\.[a-z0-9]+$/i.test(file));
      if (!files.length) return true;
      const templateChanges = files.filter((file) => /^client\/.+\.html$/.test(file));
      const styleChanges = files.filter((file) => /^(?:client\/)?public\/.+\.css$/.test(file));
      const otherChanges = files.filter((file) => !templateChanges.includes(file) && !styleChanges.includes(file));
      if (otherChanges.length) {
        console.info('[kniu-hmr] JS/组件变更，自动刷新（表单草稿已保留）：', otherChanges.join(','));
        snapshotFormDrafts();
        location.reload();
        return true;
      }
      if (templateChanges.length) {
        clearTimeout(hotTemplateTimer);
        hotTemplateTimer = setTimeout(() => { hotTemplateTimer = 0; void hotReloadTemplates('template-change'); }, 120);
      }
      styleChanges.forEach((file) => { void hotApplyWebCss(file); });
      console.info('[kniu-hmr] 已接管：', files.join(','));
      return true;
    };
  };

  const canonicalizeHomeHash = () => {
    if (routePath() !== defaultPath) return false;
    if (routeMode() === 'history') return false;
    if (!location.hash || location.hash.includes('?')) return false;
    history.replaceState(history.state, '', location.pathname + location.search);
    return true;
  };

  const onLocationChange = () => {
    canonicalizeHomeHash();
    renderWithBoundary();
  };

  const api = {
    async start() {
      manifestUrl = document.querySelector('meta[name="kniu-template-manifest"]')?.getAttribute('content') || '/templates.js';
      try {
        await import(manifestUrl);
      } catch (error) {
        throw new Error(`模板清单加载失败：${manifestUrl}`, { cause: error });
      }
      templates = globalThis.__VIEW_TEMPLATES__ || {};
      addEventListener('hashchange', onLocationChange);
      if (routeMode() === 'history') addEventListener('popstate', onLocationChange);
      canonicalizeHomeHash();
      if (typeof routerHooks.mounted === 'function') await routerHooks.mounted({ root, router: api });
      scheduleComponentPreload();
      await renderWithBoundary();
      installHmrDispatcher();
    },
    render: renderWithBoundary,
    navigate,
    beforeEach,
    afterEach,
    canonicalize: canonicalizePath,
    dispose() {
      removeEventListener('hashchange', onLocationChange);
      if (routeMode() === 'history') removeEventListener('popstate', onLocationChange);
      if (refreshRenderTimer) { clearTimeout(refreshRenderTimer); refreshRenderTimer = 0; }
      mountHidden.dispose();
      binder.resetDelegation();
    },
    get currentRoute() { return routePath(); }
  };
  return api;
}