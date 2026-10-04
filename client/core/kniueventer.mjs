import TEMPLATE from './kniutemplate/kniutemplate.mjs';
import MVVM from './kniumvvm.mjs';
import SERVER from '../config/server.js';
import { resolveAliasReferences } from './kniuutil.mjs';

const { bind, reactive, beginBindingCollection, endBindingCollection } = TEMPLATE;
const { loadController } = MVVM;

var KniuEventer = (function () {
  function createEventBus() {
    const listeners = new Map();
    return {
      on(type, handler) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(handler);
        return function () { listeners.get(type)?.delete(handler); };
      },
      off(type, handler) {
        const set = listeners.get(type);
        if (set) set.delete(handler);
      },
      emit(type, payload) {
        const set = listeners.get(type);
        if (!set) return;
        for (const fn of set) {
          try { fn(payload); } catch (e) { console.error('[EventBus]', e); }
        }
      }
    };
  }

  // $ 函数工厂。
  function create$(scope, kniusystem = {}) {
    const withEvents = function (eventTarget) {
      if (!eventTarget || eventTarget.__kniuWrapped) return eventTarget;
      try {
        Object.defineProperty(eventTarget, '__kniuWrapped', { value: true, enumerable: false });
      } catch { return eventTarget; }
      if (!eventTarget.on) {
        Object.defineProperty(eventTarget, 'on', {
          configurable: true,
          value(type, listener, options) {
            this.addEventListener(type, listener, options);
            return function () { eventTarget.removeEventListener(type, listener, options); };
          },
        });
      }
      if (!eventTarget.find) {
        Object.defineProperty(eventTarget, 'find', {
          configurable: true,
          value(selector) {
            return query(selector, this);
          },
        });
      }
      if (!eventTarget.parents) {
        Object.defineProperty(eventTarget, 'parents', {
          configurable: true,
          value(selector) {
            let el = this;
            while (el && el.matches) {
              if (el.matches(selector)) return el;
              el = el.parentElement;
            }
            return null;
          },
        });
      }
      if (!eventTarget.text) {
        Object.defineProperty(eventTarget, 'text', {
          configurable: true,
          value(content) {
            if (content === undefined) return this.textContent;
            this.textContent = content;
            return this;
          },
        });
      }
      if (!eventTarget.html) {
        Object.defineProperty(eventTarget, 'html', {
          configurable: true,
          value(content) {
            if (content === undefined) return this.innerHTML;
            this.innerHTML = content;
            return this;
          },
        });
      }
      if (!eventTarget.attr) {
        Object.defineProperty(eventTarget, 'attr', {
          configurable: true,
          value(name, value) {
            if (typeof name === 'object' && name !== null) {
              for (const [key, val] of Object.entries(name)) this.setAttribute(key, val);
              return this;
            }
            if (value === undefined) return this.getAttribute(name);
            this.setAttribute(name, value);
            return this;
          },
        });
      }
      if (!eventTarget.addClass) {
        Object.defineProperty(eventTarget, 'addClass', {
          configurable: true,
          value(...tokens) {
            const classes = tokens.flatMap(function (t) { return String(t).split(/\s+/); }).filter(Boolean);
            this.classList.add(...classes);
            return this;
          },
        });
      }
      if (!eventTarget.removeClass) {
        Object.defineProperty(eventTarget, 'removeClass', {
          configurable: true,
          value(...tokens) {
            const classes = tokens.flatMap(function (t) { return String(t).split(/\s+/); }).filter(Boolean);
            this.classList.remove(...classes);
            return this;
          },
        });
      }
      if (!eventTarget.toggleClass) {
        Object.defineProperty(eventTarget, 'toggleClass', {
          configurable: true,
          value(token, force) {
            this.classList.toggle(token, force);
            return this;
          },
        });
      }
      if (!eventTarget.css) {
        Object.defineProperty(eventTarget, 'css', {
          configurable: true,
          value(name, value) {
            if (typeof name === 'object' && name !== null) {
              for (const [key, val] of Object.entries(name)) this.css(key, val);
              return this;
            }
            if (value === undefined) {
              return name.includes('-')
                ? getComputedStyle(this).getPropertyValue(name)
                : getComputedStyle(this)[name];
            }
            if (name.includes('-')) this.style.setProperty(name, value);
            else this.style[name] = value;
            if (this.nodeType === 1 && !this.getAttribute('style')) this.removeAttribute('style');
            return this;
          },
        });
      }
      if (!eventTarget.val) {
        Object.defineProperty(eventTarget, 'val', {
          configurable: true,
          value(value) {
            if (value === undefined) {
              if (this.multiple && this.options) {
                return [...this.options].filter(function (o) { return o.selected; }).map(function (o) { return o.value; });
              }
              return this.value;
            }
            this.value = value;
            return this;
          },
        });
      }
      if (!eventTarget.show) {
        Object.defineProperty(eventTarget, 'show', {
          configurable: true,
          value() {
            this.style.display = '';
            if (this.nodeType === 1 && !this.getAttribute('style')) this.removeAttribute('style');
            return this;
          },
        });
      }
      if (!eventTarget.hide) {
        Object.defineProperty(eventTarget, 'hide', {
          configurable: true,
          value() {
            this.style.display = 'none';
            return this;
          },
        });
      }
      if (!eventTarget.off) {
        Object.defineProperty(eventTarget, 'off', {
          configurable: true,
          value(type, listener, options) {
            this.removeEventListener(type, listener, options);
            return this;
          },
        });
      }
      if (!eventTarget.data) {
        Object.defineProperty(eventTarget, 'data', {
          configurable: true,
          value(name, value) {
            const toCamel = function (s) { return s.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); };
            if (typeof name === 'object' && name !== null) {
              for (const [key, val] of Object.entries(name)) this.dataset[toCamel(key)] = val;
              return this;
            }
            if (value === undefined) {
              if (name === undefined) return { ...this.dataset };
              return this.dataset[toCamel(name)];
            }
            this.dataset[toCamel(name)] = value;
            return this;
          },
        });
      }
      if (!eventTarget.prop) {
        Object.defineProperty(eventTarget, 'prop', {
          configurable: true,
          value(name, value) {
            if (value === undefined) return this[name];
            this[name] = value;
            return this;
          },
        });
      }
      return eventTarget;
    };

    // 安全空元素：选择器未匹配到任何元素时返回它。
    const createNullElement = function () {
      return {
        __nullElement: true,
        addEventListener() { }, removeEventListener() { },
        append() { }, replaceChildren() { }, remove() { },
        setAttribute() { }, getAttribute() { return null; }, removeAttribute() { },
        matches() { return false; },
        querySelector() { return createNullElement(); },
        querySelectorAll() { return []; },
        get parentElement() { return null; },
        get children() { return []; },
        classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
        style: { setProperty() { }, getPropertyValue() { return ''; } },
        dataset: {},
        focus() { },
        get textContent() { return ''; }, set textContent(_) { },
        get innerHTML() { return ''; }, set innerHTML(_) { },
        get multiple() { return false; }, get options() { return []; },
        on() { return function () { }; }, off() { return createNullElement(); },
        find() { return createNullElement(); },
        parents() { return null; },
        text() { return createNullElement(); }, html() { return createNullElement(); },
        attr() { return createNullElement(); }, addClass() { return createNullElement(); }, removeClass() { return createNullElement(); },
        toggleClass() { return createNullElement(); }, css() { return createNullElement(); }, val() { return createNullElement(); },
        show() { return createNullElement(); }, hide() { return createNullElement(); }, data() { return createNullElement(); }, prop() { return createNullElement(); },
        forEach() { }, map() { return []; },
      };
    };

    const query = function (selector, scopeEl = scope) {
      const root = scopeEl || scope || document;
      const matches = [...root.querySelectorAll(selector)].map(withEvents);
      if (matches.length === 0) {
        if (kniusystem.strictSelectors) {
          throw new Error(`[kniu] 选择器未匹配到任何元素：${selector}`);
        }
        if (selector) console.warn('[kniu] 选择器未匹配到任何元素：', selector);
        return createNullElement();
      }
      return matches.length === 1 ? matches[0] : matches;
    };

    // 同时接受 Element / Document / ShadowRoot / DocumentFragment 等可查询节点。
    return function $(selectorOrElement, scopeEl) {
      if (selectorOrElement && typeof selectorOrElement.querySelectorAll === 'function') {
        return withEvents(selectorOrElement);
      }
      return query(selectorOrElement, scopeEl || scope);
    };
  }

  // 时间格式化工具。
  function formatTime(date) {
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  // 根据时区名获取当前时间的 Date 对象。
  function getTimeInZone(timezone) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = function (type) { return parts.find(function (p) { return p.type === type; })?.value; };
    return new Date(
      parseInt(get('year')),
      parseInt(get('month')) - 1,
      parseInt(get('day')),
      parseInt(get('hour')) % 24,
      parseInt(get('minute')),
      parseInt(get('second'))
    );
  }

  function findBundledTemplate(templates, url) {
    if (!templates || !url) return null;
    const candidates = new Set([url]);
    try {
      const pathname = new URL(url, location.href).pathname;
      candidates.add(pathname);
      candidates.add(pathname.replace(/^\/+/, ''));
    } catch {
      candidates.add(String(url).replace(/^\/+/, ''));
    }
    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(templates, key)) {
        return { key, source: templates[key] };
      }
    }
    const pathname = [...candidates][1] ?? String(url);
    for (const key of Object.keys(templates)) {
      const relativeKey = key.replace(/^\/+/, '');
      if (pathname === relativeKey || pathname.endsWith(`/${relativeKey}`)) {
        return { key, source: templates[key] };
      }
    }
    return null;
  }

  // 把 include 的相对路径解析为基于当前模板的绝对 pathname。
  function resolveTemplateIncludeUrl(includePath, baseTemplateUrl) {
    if (!includePath) return includePath;
    if (includePath.startsWith('/')) return includePath;
    try {
      const base = new URL(baseTemplateUrl, location.href);
      return new URL(includePath, base).pathname;
    } catch {
      return includePath;
    }
  }

  function resolveTemplateIncludes(source, baseTemplateUrl) {
    const re = /<include\b[^>]*\bsrc="([^"]*)"[^>]*>(?:<\/include>)?/g;
    return source.replace(re, function (full, includePath) {
      const url = resolveTemplateIncludeUrl(includePath, baseTemplateUrl);
      const parts = url.replaceAll('\\', '/').replace(/\.html$/, '').split('/').filter(Boolean);
      const commonIndex = parts.lastIndexOf('common');
      const names = commonIndex > 0 ? parts.slice(commonIndex - 1) : parts.slice(-2);
      const tag = 'kniu-system-' + names.join('-').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
      return '<' + tag + '></' + tag + '>';
    });
  }

  function normalizeTagName(name) {
    return name
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
  }
  function expandPascalTags(html) {
    return String(html).replace(/<\/?[A-Z][A-Za-z0-9]*(?=[\s>/>])/g, function (match) {
      const isClosing = match.startsWith('</');
      const slashEnd = match.endsWith('/');
      const name = match.replace(/^<\/?/, '');
      const opening = isClosing ? '</' : '<';
      return opening + normalizeTagName(name) + (slashEnd ? '/' : '');
    });
  }

  function slotNameOfTemplate(template) {
    const byAttr = template.getAttribute('slot');
    if (byAttr) return byAttr;
    const hashAttr = [...template.attributes].find(function (a) { return a.name[0] === '#'; });
    return hashAttr ? hashAttr.name.slice(1) : null;
  }
  function flattenSlotTemplates(root) {
    if (!root || !root.querySelectorAll) return;
    const templates = [...root.querySelectorAll('template')].filter(function (template) {
      const parent = template.parentNode;
      if (!parent) return false;
      const parentTag = parent.tagName.toLowerCase();
      const name = slotNameOfTemplate(template);
      if (parentTag === 'kniu-modal') {
        return name === 'header' || name === 'default' || name === 'footer';
      }
      if (parentTag === 'kniu-table') {
        return name === 'empty';
      }
      if (parentTag === 'kniu-sub-navbar') {
        return name === 'title';
      }
      if (parentTag === 'kniu-navbar') {
        return name === 'brand' || name === 'append' || name === 'default';
      }
      return false;
    });
    templates.forEach(function (template) {
      const slotName = slotNameOfTemplate(template);
      const parent = template.parentNode;
      if (!parent) return;
      const frag = document.createDocumentFragment();
      [...template.content.childNodes].forEach(function (node) {
        if (node.nodeType === 1) {
          if (!node.hasAttribute('slot')) node.setAttribute('slot', slotName);
          frag.appendChild(node);
        } else if (node.nodeType === 3) {
          if (node.textContent.trim() === '') return;
          const wrap = document.createElement('span');
          wrap.setAttribute('slot', slotName);
          wrap.textContent = node.textContent;
          frag.appendChild(wrap);
        }
      });
      parent.replaceChild(frag, template);
    });
  }

  async function loadHtmlTemplate(templateUrl, target, signal, kniusystem = {}, mountController) {
    const templates = globalThis.__VIEW_TEMPLATES__;
    const bundledTemplate = findBundledTemplate(templates, templateUrl);
    let resolved = bundledTemplate?.key ?? templateUrl;
    let source = bundledTemplate?.source;
    if (!source) {
      const response = await fetch(resolved, { signal });
      if (!response.ok) {
        const available = templates ? Object.keys(templates) : [];
        throw new Error(
          `Unable to load HTML template: ${resolved}` +
          (available.length ? `\n可用模板: ${available.join(', ')}` : ''),
        );
      }
      source = await response.text();
    }
    templateUrl = resolved;
    let expandedSource = expandPascalTags(
      resolveTemplateIncludes(resolveAliasReferences(source, SERVER.ALIAS), templateUrl)
    ).replace(/<(kniu-[a-z0-9-]+)([^<>]*?)\s*\/>/gi, '<$1$2></$1>');
    const fragment = document.createRange().createContextualFragment(expandedSource);
    flattenSlotTemplates(fragment);
    const scripts = [...fragment.querySelectorAll('script')];
    scripts.forEach(function (script) { return script.remove(); });
    target.replaceChildren(fragment);

    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    const $ = create$(target, kniusystem);
    const contextReactive = function (state) {
      if (
        state &&
        typeof state === 'object' &&
        Object.isExtensible(state) &&
        !Object.prototype.hasOwnProperty.call(state, 'emit') &&
        typeof kniusystem.eventTo?.emit === 'function'
      ) {
        Object.defineProperty(state, 'emit', {
          value: kniusystem.eventTo.emit.bind(kniusystem.eventTo),
          configurable: true,
        });
      }
      return reactive(state);
    };
    const templateKniuSystem = {
      ...kniusystem,
      templateUrl,
      signal,
      $,
      bind,
      reactive: contextReactive,
      on: function (eventTarget, type, listener, options) {
        const wrapped = $(eventTarget || document);
        return wrapped.on(type, listener, options);
      },
    };
    const cleanups = [];
    const reactiveDisposers = [];
    const execute = async function (task) {
      beginBindingCollection(target, reactiveDisposers);
      let cleanup;
      try {
        const result = task();
        endBindingCollection();
        cleanup = await result;
        if (typeof cleanup === 'function') cleanups.push(cleanup);
      } finally {
        endBindingCollection();
      }
    };
    try {
      for (const script of scripts) {
        await execute(function () { return new AsyncFunction('root', 'kniusystem', script.textContent)(target, templateKniuSystem); });
      }
      if (typeof mountController === 'function') {
        await execute(function () { return mountController(templateKniuSystem, target); });
      }
    } catch (error) {
      cleanups.reverse().forEach(function (cleanup) { return cleanup(); });
      reactiveDisposers.reverse().forEach(function (dispose) { return dispose(); });
      throw error;
    }

    return function () {
      cleanups.reverse().forEach(function (cleanup) { return cleanup(); });
      reactiveDisposers.reverse().forEach(function (dispose) { return dispose(); });
    };
  }
  function createTemplateApp(templateUrl, controller) {
    return {
      controller,
      templateUrl,
      async mount(kniusystem, root) {
        const abortController = new AbortController();
        const dispose = await loadHtmlTemplate(
          templateUrl,
          root,
          abortController.signal,
          kniusystem,
          controller?.mount?.bind(controller),
        );
        return function () {
          abortController.abort();
          dispose?.();
        };
      }
    };
  }

  function createRouteRecord(path, controller, controllerPath = '') {
    return {
      path: path,
      controller: controller,
      controllerPath: controllerPath,
    };
  }

  function normalizeRoutePath(path) {
    const value = String(path ?? '').trim();
    if (!value || value === '/') return '/';
    return '/' + value.replace(/^\/+|\/+$/g, '');
  }

  class RouterRegistry extends Array {
    add(path, controller) {
      const routeController = typeof controller === 'string'
        ? function loadRouteController() { return loadController(controller); }
        : controller;
      super.push(createRouteRecord(
        normalizeRoutePath(path),
        routeController,
        typeof controller === 'string' ? controller : ''
      ));
      return this;
    }
  }
  const ROUTER = new RouterRegistry();
  return {
    createEventBus: createEventBus,
    create$: create$,
    formatTime: formatTime,
    getTimeInZone: getTimeInZone,
    loadHtmlTemplate: loadHtmlTemplate,
    createTemplateApp: createTemplateApp,
    createRouteRecord: createRouteRecord,
    RouterRegistry: RouterRegistry,
    ROUTER: ROUTER
  };
}());

const { ROUTER } = KniuEventer;

export { ROUTER };
export default KniuEventer;
