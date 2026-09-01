import KniuTemplate from './kniutemplate.mjs';
import KniuMvvm from './kniumvvm.mjs';
import SERVER from '../config/server.js';
import { resolveAliasReferences } from './kniuutil.mjs';

const { bind, reactive, beginBindingCollection, endBindingCollection } = KniuTemplate;
const { loadController } = KniuMvvm;

var KniuEventer = (function () {
  // 简易事件总线，支持 on / off / emit。
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

  // 将 <include src="..."> 替换为对应的自定义元素标签 <kniu-system-xxx></kniu-system-xxx>。
  // VIEWS 配置目录下的每个 .html 文件都注册为独立的 Shadow DOM 自定义元素，
  // include 不再在字符串层面内联，而是渲染为嵌套 Shadow DOM 自定义元素。
  // 各自定义元素在 connectedCallback 中自行加载模板并创建 Shadow Root，
  // 天然避免循环引用问题，也无需递归展开。
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

  // 支持 PascalCase / camelCase 自定义标签写法（如 <KniuInputGroup>、<House>）。
  // HTML 解析器会把它们小写化为无连字符形式（kniuinputgroup），因此需要在解析前转换。
  // 仅作用于「标签名」位置（< 或 </ 后紧跟大写开头的标识符），不影响属性值中的大写。
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

  // 把 <template slot="X"> 或 <template #X>（框架约定的 v-slot 简写，等同 slot="X"）平铺为带 slot 属性的真实子节点。
  // Web Components 的 slot 算法不会展开 <template>（template 是 inert 元素，只在 .content 里存有内容），
  // 所以 <slot name="X"> 在 light DOM 里只能拿到 <template> 元素本身（render 出来还是空的）。
  // 这里是框架级兼容：递归走 fragment，把所有带 slot 的 <template> 替换为其 content 子节点的副本，
  // 并把 slot 属性复制到每个顶层元素子节点（顶层文本节点不必 slot——slot 默认就是 default）。
  // 处理组件直接子模板：kniu-modal（header / default / footer）、kniu-table（empty）及 kniu-navbar（brand / append / default）。
  // 组件内部的 #prepend / #append / #default（如 kniu-table-col、kniu-input）由各自组件自行处理，不能在这里平铺。
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
      const isNavbarDefaultSlot = parent.tagName.toLowerCase() === 'kniu-navbar' && slotName === 'default';
      const frag = document.createDocumentFragment();
      [...template.content.childNodes].forEach(function (node) {
        if (node.nodeType === 1) {
          // 元素节点：直接补上 slot 属性（已有则保留）。
          if (!isNavbarDefaultSlot && !node.hasAttribute('slot')) node.setAttribute('slot', slotName);
          frag.appendChild(node);
        } else if (node.nodeType === 3) {
          // 文本节点无法携带 slot 属性，必须包一层带 slot 的元素，
          // 否则会落入默认插槽（位置/样式与具名插槽不符）。
          // 例：<template #brand>KniuSystem</template> 的文本应进入 brand 插槽（左侧），
          // 而非默认插槽（navbar 的 .menu，右侧）。
          if (node.textContent.trim() === '') return;
          const wrap = document.createElement('span');
          if (!isNavbarDefaultSlot) wrap.setAttribute('slot', slotName);
          wrap.textContent = node.textContent;
          frag.appendChild(wrap);
        }
        // 注释等其它节点忽略
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
    let expandedSource = resolveTemplateIncludes(
      resolveAliasReferences(source, SERVER.ALIAS),
      templateUrl
    ).replace(/<(kniu-[a-z0-9-]+)([^<>]*?)\s*\/>/gi, '<$1$2></$1>');
    expandedSource = expandPascalTags(expandedSource);
    const fragment = document.createRange().createContextualFragment(expandedSource);
    // 把 <template slot="X"> 或 <template #X>（简写）平铺为带 slot 属性的真实子节点：
    //   <template #header><span>标题</span><kniu-btn>...</kniu-btn></template>
    //   => <span slot="header">标题</span>  <kniu-btn slot="header">...</kniu-btn>
    // Web Components 的 slot 算法不会展开 <template>（template 是 inert），否则具名插槽拿不到内容。
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
      // 绑定收集只在任务「同步段」有效（setup 内 reactive(state) 的 auto-bind 依赖 currentScope）。
      // 若跨 await 保持 currentScope，异步回调（如 onMounted 里的接口返回后 kniuui.js 内部
      // reactive(行对象/表格配置)）会触发对整棵视图树的伪绑定——用数据对象当 state 重新解析
      // 所有 kniu:options / kniu:model，把列模板内 switch 的 expando 覆盖成 {}（2026-09-01 修复）。
      // 因此：先同步调用 task() 跑完 sync 段，随即清空收集，再 await 异步余段。
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

  // 创建路由记录，仅包含路径和控制器映射。
  function createRouteRecord(path, controller, authRequired = false, controllerPath = '') {
    return {
      path: path,
      controller: controller,
      controllerPath: controllerPath,
      authRequired: authRequired,
    };
  }

  function normalizeRoutePath(path) {
    const value = String(path ?? '').trim();
    if (!value || value === '/') return '/';
    return '/' + value.replace(/^\/+|\/+$/g, '');
  }

  // 路由注册表：底层是数组，提供语义明确的 addRoute 注册方法。
  class RouterRegistry extends Array {
    #authLevel = 0;
    addRoute(path, controller) {
      const authRequired = this.#authLevel > 0;
      const routeController = typeof controller === 'string'
        ? function loadRouteController() { return loadController(controller); }
        : controller;
      super.push(createRouteRecord(
        normalizeRoutePath(path),
        routeController,
        authRequired,
        typeof controller === 'string' ? controller : ''
      ));
      return this;
    }
    auth(callback) {
      this.#authLevel++;
      try {
        callback(this);
      } finally {
        this.#authLevel--;
      }
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

export default KniuEventer;