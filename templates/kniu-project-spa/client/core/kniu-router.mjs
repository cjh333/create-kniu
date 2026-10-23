import { escapeHtml, evaluateTemplateExpression, renderTemplate } from './kniu-template.mjs';
import { createRequest } from './kniu-request.mjs';
import { loadComponents } from './kniu-component-loader.mjs';
import { updateHead } from './kniu-head.mjs';

export const hooks = {
  async beforeEach({ to }) {
    document.documentElement.dataset.route = to;
  },
  afterEach({ to }) {
    console.debug(`[kniu-router] navigated to ${to}`);
  }
};

export function createRouter({ root, routes, data = () => ({}), actions = {}, hooks: customHooks = {}, viewer = {}, loading = true }) {
  const request = createRequest();
  root.style.overflowAnchor = 'none';
  const routerHooks = { ...hooks, ...customHooks };
  let templates = {};
  const flattenedRoutes = {};
  const flattenRoutes = (entries, parent = '', ancestors = []) => Object.entries(entries || {}).forEach(([path, route]) => {
    const fullPath = parent ? `${parent.replace(/\/$/, '')}/${path.replace(/^\//, '')}`.replace(/\/+/g, '/') : (path.startsWith('/') ? path : `/${path}`);
    flattenedRoutes[fullPath] = { ...route, path: fullPath, matched: [...ancestors, fullPath] };
    if (route.children) flattenRoutes(route.children, fullPath, [...ancestors, fullPath]);
  });
  flattenRoutes(routes);
  const routeTable = flattenedRoutes;
  const defaultPath = Object.entries(routeTable).find(([, route]) => route.default)?.[0] || Object.keys(routeTable)[0] || '/';
  let currentPath = defaultPath;
  const controllers = new Map();
  const controllerInstances = new Map();
  const controllerSubscriptions = new Map();
  const mountedControllers = new Set();
  let activeController = null;
  let pendingNavigation = 0;
  let renderQueued = false;
  let textBindings = new Map();
  let lastModel = {};
  let suppressRender = false;
  const guards = { beforeEach: [], afterEach: [] };
  const loadingOptions = typeof loading === 'object' ? loading : { enabled: loading !== false };
  const clientPath = (value, label) => {
    const normalized = String(value || '').replaceAll('\\', '/').replace(/^\/+/, '');
    if (!normalized || normalized.split('/').includes('..')) throw new Error(`无效${label}路径：${value}`);
    return normalized;
  };
  const templateUrl = (value) => `/client/views/${clientPath(value, '模板')}`;
  const controllerUrl = (value) => `/client/controller/${clientPath(value, '控制器')}`;
  const normalize = (value) => {
    const path = String(value || '').replace(/^#/, '').split('?')[0] || '/';
    return path.length > 1 ? path.replace(/\/$/, '') : path;
  };
  const routePath = () => normalize(location.hash || defaultPath);
  const resolveTarget = (path, params = {}) => normalize(path).replace(/:([A-Za-z_$][\w$]*)/g, (_, key) => {
    if (params[key] === undefined || params[key] === null) throw new Error(`路由参数缺失：${key}`);
    return encodeURIComponent(params[key]);
  });
  const navigate = (path, params = {}) => {
    const target = resolveTarget(path, params);
    if (routePath() === target) renderWithBoundary();
    else location.hash = target;
  };
  const beforeEach = (guard) => { if (typeof guard !== 'function') throw new TypeError('beforeEach 需要函数'); guards.beforeEach.push(guard); return () => guards.beforeEach.splice(guards.beforeEach.indexOf(guard), 1); };
  const afterEach = (hook) => { if (typeof hook !== 'function') throw new TypeError('afterEach 需要函数'); guards.afterEach.push(hook); return () => guards.afterEach.splice(guards.afterEach.indexOf(hook), 1); };
  function setPath(scope, path, value) {
    const keys = path.replace(/^{{\s*|\s*}}$/g, '').trim().split('.');
    let target = scope;
    keys.slice(0, -1).forEach((key) => { target = target[key] ?? (target[key] = {}); });
    target[keys.at(-1)] = value;
  }
  function collectTextBindings(host) {
    textBindings = new Map();
    const comments = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_COMMENT);
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach(function (node) {
      const data = String(node.data || '');
      const start = /^kniu-t:(.+)$/.exec(data);
      if (!start) { if (data === '/kniu-t') node.remove(); return; }
      const [encoded, rawFlag] = start[1].split('|raw');
      let next = node.nextSibling;
      if (next && next.nodeType === Node.COMMENT_NODE && next.data === '/kniu-t') {
        next = next.parentNode.insertBefore(document.createTextNode(''), next);
      }
      if (next && next.nodeType === Node.TEXT_NODE) {
        const expr = decodeURIComponent(encoded);
        const entry = textBindings.get(expr) || { raw: rawFlag === '1', nodes: [] };
        entry.nodes.push(next);
        textBindings.set(expr, entry);
      }
      node.remove();
    });
  }
  function patchTextBindings() {
    textBindings.forEach(function (entry, expr) {
      const value = entry.raw
        ? String(evaluateTemplateExpression(expr, lastModel) ?? '')
        : escapeHtml(evaluateTemplateExpression(expr, lastModel));
      entry.nodes.forEach(function (node) { if (node.textContent !== value) node.textContent = value; });
    });
  }
  function bind(model) {
    root.querySelectorAll('a[href^="#/"]').forEach((link) => {
      link.addEventListener('click', (event) => { if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(link.getAttribute('href')); });
    });
    root.querySelectorAll('[data-action]').forEach((element) => {
      const action = actions[element.dataset.action];
      if (typeof action === 'function') element.addEventListener('click', action);
    });
    root.querySelectorAll('[data-kniu-form]').forEach((element) => {
      const path = decodeURIComponent(element.dataset.kniuForm || '');
      element.addEventListener('input', () => { suppressRender = true; setPath(model, path, element.value); suppressRender = false; });
      element.addEventListener('change', () => { suppressRender = true; setPath(model, path, element.value); suppressRender = false; });
    });
    root.querySelectorAll('[data-kniu-event]').forEach((element) => {
      const descriptor = element.dataset.kniuEvent.split('.');
      const eventName = descriptor.shift();
      const handlerCode = decodeURIComponent(element.dataset.kniuHandler || '');
      const modifiers = new Set(descriptor);
      const listener = (event) => {
        if (modifiers.has('enter') && event.key !== 'Enter') return;
        if (modifiers.has('esc') && event.key !== 'Escape') return;
        if (modifiers.has('tab') && event.key !== 'Tab') return;
        if (modifiers.has('exact') && (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)) return;
        if (modifiers.has('ctrl') && !event.ctrlKey) return;
        if (modifiers.has('shift') && !event.shiftKey) return;
        if (modifiers.has('alt') && !event.altKey) return;
        if (modifiers.has('meta') && !event.metaKey) return;
        if (modifiers.has('self') && event.target !== event.currentTarget) return;
        if (modifiers.has('prevent')) event.preventDefault();
        if (modifiers.has('stop')) event.stopPropagation();
        const call = /^([\w$]+)(?:\((.*)\))?$/.exec(handlerCode);
        const name = call?.[1] || handlerCode;
        const handler = actions[name] || model[name];
        if (typeof handler !== 'function') return;
        const args = call?.[2] ? splitArguments(call[2]).map((item) => parseEventArgument(item, model, event)) : [event];
        handler.apply(model, args);
      };
      element.addEventListener(eventName, listener, { once: modifiers.has('once') });
    });
  }
  function splitArguments(source) {
    const parts = []; let start = 0; let depth = 0; let quote = '';
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (quote) { if (char === '\\') index += 1; else if (char === quote) quote = ''; continue; }
      if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
      if ('([{'.includes(char)) depth += 1;
      else if (')]}'.includes(char)) depth -= 1;
      else if (char === ',' && depth === 0) { parts.push(source.slice(start, index).trim()); start = index + 1; }
    }
    if (source.slice(start).trim()) parts.push(source.slice(start).trim());
    return parts;
  }
  function parseEventArgument(source, model, event) {
    const value = source.trim();
    if (value === '$event') return event;
    if (/^(['"]).*\1$/s.test(value)) return value.slice(1, -1).replace(/\\(['"\\])/g, '$1');
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number(value);
    return value.split('.').reduce((result, key) => result?.[key], model);
  }
  async function expandIncludes(source, fileUrl, ancestors = [], scope = {}) {
    const includePattern = /<include\s+src\s*=\s*(["'])(.*?)\1\s*\/\s*>/gi;
    const matches = [...source.matchAll(includePattern)];
    let output = source;
    for (const match of matches) {
      const includeUrl = new URL(match[2], `http://kniu.local${fileUrl}`).pathname;
      if (!includeUrl.startsWith('/client/views/') || ancestors.includes(includeUrl)) throw new Error(`无效或循环 include：${includeUrl}`);
      const includeSource = templates[includeUrl];
      if (includeSource === undefined) throw new Error(`include 模板不存在：${includeUrl}`);
      const nested = await expandIncludes(includeSource, includeUrl, [...ancestors, includeUrl], scope);
      const controllerPath = viewer[includeUrl.replace('/client/views/', '')];
      let rendered = nested;
      if (controllerPath) {
        const url = controllerUrl(controllerPath);
        const module = controllers.get(url) || (await import(url));
        controllers.set(url, module);
        const factory = module.default || module;
        const model = typeof factory === 'function' ? await factory({ include: includeUrl }) || {} : factory || {};
        rendered = renderTemplate(nested, { ...scope, ...model });
      }
      output = output.replace(match[0], rendered);
    }
    return output;
  }
  async function render() {
    const from = currentPath;
    const to = routePath();
    const navigationId = ++pendingNavigation;
    const matched = Object.entries(routeTable).find(([path]) => new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:([A-Za-z_$][\w$]*)/g, '([^/]+)')}$`).test(to));
    const resolvedPath = matched?.[0] || defaultPath;
    const route = routeTable[resolvedPath];
    const values = matched ? new RegExp(`^${resolvedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:([A-Za-z_$][\w$]*)/g, '([^/]+)')}$`).exec(to)?.slice(1) || [] : [];
    const keys = [...resolvedPath.matchAll(/:([A-Za-z_$][\w$]*)/g)].map((match) => match[1]);
    const params = Object.fromEntries(keys.map((key, index) => [key, decodeURIComponent(values[index] || '')]));
    const context = { to, from, route, params, matched: route.matched, query: new URLSearchParams(location.hash.split('?')[1] || '') };
    const rerenderScroll = to === from ? window.scrollY : null;
    for (const guard of [...guards.beforeEach, route.beforeEnter].filter(Boolean)) if (await guard(context) === false) return;
    if (navigationId !== pendingNavigation) return;
    if (typeof routerHooks.beforeEach === 'function' && await routerHooks.beforeEach(context) === false) return;
    const nextControllerKey = route.controller ? controllerUrl(route.controller) : null;
    if (activeController && activeController !== nextControllerKey) {
      await controllerInstances.get(activeController)?.__kniuLifecycle?.beforeUnmount?.({ root, context });
      await controllerInstances.get(activeController)?.__kniuLifecycle?.unmounted?.({ root, context });
      mountedControllers.delete(activeController);
    }
    if (typeof routerHooks.beforeLoad === 'function') await routerHooks.beforeLoad(context);
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
        controllerInstance = typeof factory === 'function' ? await factory({ ...context, request, navigate }) || {} : factory || {};
        controllerInstances.set(url, controllerInstance);
      }
      controllerData = controllerInstance;
    }
    const templateValue = typeof route.template === 'function' ? await route.template(context) : route.template;
    const resolvedTemplate = templateUrl(templateValue);
    const source = templates[resolvedTemplate];
    if (!source) { root.innerHTML = `<p>模板未找到：${escapeHtml(resolvedTemplate)}</p>`; return; }
    if (typeof routerHooks.beforeRender === 'function') await routerHooks.beforeRender(context);
    const includeRoute = { ...route, title: typeof route.title === 'function' ? String(route.title({ model: controllerData, params }) ?? '') : route.title };
    const expandedSource = await expandIncludes(source, resolvedTemplate, [resolvedTemplate], { route: includeRoute, params });
    const model = { ...data(), route, params, navigate };
    Object.keys(controllerData || {}).forEach(function (key) {
      const descriptor = Object.getOwnPropertyDescriptor(controllerData, key);
      const property = { enumerable: true, get: function () { return controllerData[key]; } };
      if (!descriptor || descriptor.set || descriptor.writable) property.set = function (value) { controllerData[key] = value; };
      Object.defineProperty(model, key, property);
    });
    await controllerInstance?.__kniuLifecycle?.beforeMount?.({ root, model, context });
    if (navigationId !== pendingNavigation) return;
    const active = root.contains(document.activeElement) ? document.activeElement : null;
    const focusForm = active?.getAttribute('data-kniu-form') || '';
    const focusStart = active && 'selectionStart' in active ? active.selectionStart : null;
    const focusEnd = active && 'selectionEnd' in active ? active.selectionEnd : null;
    lastModel = model;
    const holdHeight = root.offsetHeight;
    if (holdHeight) root.style.minHeight = `${holdHeight}px`;
    root.innerHTML = renderTemplate(expandedSource, model, { collect: true });
    collectTextBindings(root);
    await loadComponents(root);
    if (navigationId !== pendingNavigation) return;
    const titleValue = typeof route.title === 'function' ? await route.title({ ...context, model }) : route.title;
    const seo = typeof route.seo === 'function' ? await route.seo({ ...context, model }) : route.seo || {};
    updateHead({ title: seo.title || (titleValue ? `Kniu 示例｜${titleValue}` : 'Kniu 示例'), description: seo.description, canonical: seo.canonical || `${location.origin}${location.pathname}${to === '/' ? '' : `#${to}`}`, image: seo.image, type: seo.type, jsonLd: seo.jsonLd });
    bind(model);
    if (navigationId !== pendingNavigation) return;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const restoreScroll = typeof rerenderScroll === 'number' ? rerenderScroll : 0;
    void root.offsetHeight;
    window.scrollTo(0, restoreScroll);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { root.style.minHeight = ''; window.scrollTo(0, restoreScroll); });
    });
    setTimeout(() => { window.scrollTo(0, restoreScroll); }, 120);
    if (focusForm) {
      const restored = root.querySelector(`[data-kniu-form="${focusForm.replace(/"/g, '\\"')}"]`);
      if (restored) {
        restored.focus({ preventScroll: true });
        if (focusStart != null && typeof restored.setSelectionRange === 'function') restored.setSelectionRange(focusStart, focusEnd ?? focusStart);
      }
    }
    currentPath = resolvedPath;
    activeController = nextControllerKey;
    if (controllerInstance && !mountedControllers.has(nextControllerKey)) {
      mountedControllers.add(nextControllerKey);
      await controllerInstance.__kniuLifecycle?.mounted?.({ root, model, context });
      if (!controllerSubscriptions.has(nextControllerKey)) {
        controllerSubscriptions.set(nextControllerKey, controllerInstance.__kniuSubscribe?.(() => {
          if (activeController !== nextControllerKey) return;
          if (suppressRender) { patchTextBindings(); return; }
          if (renderQueued) return;
          renderQueued = true;
          queueMicrotask(() => { renderQueued = false; renderWithBoundary(); });
        }) || null);
      }
    }
    if (typeof routerHooks.afterEach === 'function') await routerHooks.afterEach(context);
    if (typeof routerHooks.afterRender === 'function') await routerHooks.afterRender(context);
    for (const hook of guards.afterEach) await hook(context);
  }
  async function renderWithBoundary() {
    root.setAttribute('aria-busy', 'true');
    const loadingEnabled = loadingOptions.enabled !== false;
    if (loadingEnabled) {
      root.dataset.kniuLoading = 'true';
      const indicator = document.createElement('div');
      indicator.className = 'kniu-route-loading';
      indicator.setAttribute('role', 'status');
      indicator.textContent = loadingOptions.text || '加载中…';
      root.prepend(indicator);
    }
    try {
      await render();
      root.removeAttribute('data-kniu-error');
    } catch (error) {
      console.error('[kniu-router] 页面渲染失败：', error);
      root.dataset.kniuError = 'true';
      root.innerHTML = `<section class="kniu-route-error" role="alert"><h1>页面加载失败</h1><p>${escapeHtml(error?.message || '请稍后重试。')}</p><button type="button" data-kniu-retry>重试</button></section>`;
      root.querySelector('[data-kniu-retry]')?.addEventListener('click', renderWithBoundary, { once: true });
    } finally {
      root.removeAttribute('aria-busy');
      delete root.dataset.kniuLoading;
      root.querySelector(':scope > .kniu-route-loading')?.remove();
    }
  }
  const api = {
    async start() {
      const manifestUrl = document.querySelector('meta[name="kniu-template-manifest"]')?.getAttribute('content') || '/templates.js';
      try {
        await import(manifestUrl);
      } catch (error) {
        throw new Error(`模板清单加载失败：${manifestUrl}`, { cause: error });
      }
      templates = globalThis.__VIEW_TEMPLATES__ || {};
      addEventListener('hashchange', renderWithBoundary);
      if (typeof routerHooks.mounted === 'function') await routerHooks.mounted({ root, router: api });
      await renderWithBoundary();
    },
    render: renderWithBoundary,
    navigate,
    beforeEach,
    afterEach,
    get currentRoute() { return routePath(); }
  };
  return api;
}