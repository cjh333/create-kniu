import { bind, reactive, beginBindingCollection, endBindingCollection } from './kniutemplate.mjs';

// 同时兼容根路径（/views/...）和部署子目录下的相对路径（views/...）。
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

// 从模板清单或网络取得源码（与 loadHtmlTemplate 同源解析逻辑）。
async function loadTemplateSource(url, signal) {
  const templates = globalThis.__VIEW_TEMPLATES__;
  const bundledTemplate = findBundledTemplate(templates, url);
  let resolved = bundledTemplate?.key ?? url;
  let source = bundledTemplate?.source;
  if (!source) {
    const response = await fetch(resolved, { signal });
    if (!response.ok) {
      throw new Error(`无法加载 include 模板: ${resolved}`);
    }
    source = await response.text();
  }
  return { resolved, source };
}

// 在字符串层面递归展开 <include src="...">。
// 之所以在字符串层面处理：浏览器会把自闭合写法的 <include /> 当成普通未知元素，
// 导致后续兄弟节点被误吞为它的子节点；先展开再整体解析即可规避。
async function resolveTemplateIncludes(source, baseTemplateUrl, signal, visitedUrls = new Set()) {
  const re = /<include\b[^>]*\bsrc="([^"]*)"[^>]*>(?:<\/include>)?/g;
  let result = '';
  let lastIndex = 0;
  let match;
  while ((match = re.exec(source)) !== null) {
    const full = match[0];
    const includePath = match[1];
    const url = resolveTemplateIncludeUrl(includePath, baseTemplateUrl);
    result += source.slice(lastIndex, match.index);
    if (visitedUrls.has(url)) {
      console.warn(`[kniu] 检测到 include 循环引用，已跳过: ${url}`);
    } else {
      const { resolved, source: nestedSource } = await loadTemplateSource(url, signal);
      const nestedVisitedUrls = new Set(visitedUrls);
      nestedVisitedUrls.add(url);
      result += await resolveTemplateIncludes(nestedSource, resolved, signal, nestedVisitedUrls);
    }
    lastIndex = match.index + full.length;
  }
  result += source.slice(lastIndex);
  return result;
}

export async function loadHtmlTemplate(templateUrl, target, signal, kniusystem = {}, mountController) {
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
  const expandedSource = await resolveTemplateIncludes(source, templateUrl, signal);
  const fragment = document.createRange().createContextualFragment(expandedSource);
  const scripts = [...fragment.querySelectorAll('script')];
  scripts.forEach((script) => script.remove());
  target.replaceChildren(fragment);

  const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
  const withEvents = (eventTarget) => {
    if (eventTarget && !eventTarget.on) {
      Object.defineProperty(eventTarget, 'on', {
        configurable: true,
        value(type, listener, options) {
          this.addEventListener(type, listener, options);
          return () => this.removeEventListener(type, listener, options);
        },
      });
    }
    if (eventTarget && !eventTarget.find) {
      Object.defineProperty(eventTarget, 'find', {
        configurable: true,
        value(selector) {
          return query(selector, this);
        },
      });
    }
    if (eventTarget && !eventTarget.parents) {
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
    if (eventTarget && !eventTarget.text) {
      Object.defineProperty(eventTarget, 'text', {
        configurable: true,
        value(content) {
          if (content === undefined) return this.textContent;
          this.textContent = content;
          return this;
        },
      });
    }
    if (eventTarget && !eventTarget.html) {
      Object.defineProperty(eventTarget, 'html', {
        configurable: true,
        value(content) {
          if (content === undefined) return this.innerHTML;
          this.innerHTML = content;
          return this;
        },
      });
    }
    if (eventTarget && !eventTarget.attr) {
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
    if (eventTarget && !eventTarget.addClass) {
      Object.defineProperty(eventTarget, 'addClass', {
        configurable: true,
        value(...tokens) {
          const classes = tokens.flatMap((t) => String(t).split(/\s+/)).filter(Boolean);
          this.classList.add(...classes);
          return this;
        },
      });
    }
    if (eventTarget && !eventTarget.removeClass) {
      Object.defineProperty(eventTarget, 'removeClass', {
        configurable: true,
        value(...tokens) {
          const classes = tokens.flatMap((t) => String(t).split(/\s+/)).filter(Boolean);
          this.classList.remove(...classes);
          return this;
        },
      });
    }
    if (eventTarget && !eventTarget.toggleClass) {
      Object.defineProperty(eventTarget, 'toggleClass', {
        configurable: true,
        value(token, force) {
          this.classList.toggle(token, force);
          return this;
        },
      });
    }
    if (eventTarget && !eventTarget.css) {
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
    if (eventTarget && !eventTarget.val) {
      Object.defineProperty(eventTarget, 'val', {
        configurable: true,
        value(value) {
          if (value === undefined) {
            if (this.multiple && this.options) {
              return [...this.options].filter((o) => o.selected).map((o) => o.value);
            }
            return this.value;
          }
          this.value = value;
          return this;
        },
      });
    }
    if (eventTarget && !eventTarget.show) {
      Object.defineProperty(eventTarget, 'show', {
        configurable: true,
        value() {
          this.style.display = '';
          return this;
        },
      });
    }
    if (eventTarget && !eventTarget.hide) {
      Object.defineProperty(eventTarget, 'hide', {
        configurable: true,
        value() {
          this.style.display = 'none';
          return this;
        },
      });
    }
    if (eventTarget && !eventTarget.off) {
      Object.defineProperty(eventTarget, 'off', {
        configurable: true,
        value(type, listener, options) {
          this.removeEventListener(type, listener, options);
          return this;
        },
      });
    }
    if (eventTarget && !eventTarget.data) {
      Object.defineProperty(eventTarget, 'data', {
        configurable: true,
        value(name, value) {
          const toCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
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
    if (eventTarget && !eventTarget.prop) {
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
  // 安全空元素：选择器未匹配到任何元素时返回它，使模板里的
  // `$(sel).on(...)` / `.text(...)` 等变成无操作而不是抛
  // “Cannot read properties of null (reading 'on')”。
  function createNullElement() {
    const el = {
      __nullElement: true,
      addEventListener() {}, removeEventListener() {},
      append() {}, replaceChildren() {}, remove() {},
      setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
      matches() { return false; },
      querySelector() { return createNullElement(); },
      querySelectorAll() { return []; },
      get parentElement() { return null; },
      get children() { return []; },
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      style: { setProperty() {}, getPropertyValue() { return ''; } },
      dataset: {},
      focus() {},
      get textContent() { return ''; }, set textContent(_) {},
      get innerHTML() { return ''; }, set innerHTML(_) {},
      get multiple() { return false; }, get options() { return []; },
      on() { return () => {}; }, off() { return el; },
      find() { return createNullElement(); },
      parents() { return null; },
      text() { return el; }, html() { return el; },
      attr() { return el; }, addClass() { return el; }, removeClass() { return el; },
      toggleClass() { return el; }, css() { return el; }, val() { return el; },
      show() { return el; }, hide() { return el; }, data() { return el; }, prop() { return el; },
      forEach() {}, map() { return []; },
    };
    return el;
  }
  withEvents(target);
  const query = (selector, scope = target) => {
    const matches = [...scope.querySelectorAll(selector)].map(withEvents);
    if (matches.length === 0) {
      if (kniusystem.strictSelectors) {
        throw new Error(`[kniu] 选择器未匹配到任何元素：${selector}`);
      }
      if (selector) console.warn('[kniu] 选择器未匹配到任何元素：', selector);
      return createNullElement();
    }
    return matches.length === 1 ? matches[0] : matches;
  };
  const $ = (selectorOrElement, scope = target) => {
    if (selectorOrElement instanceof Element) return withEvents(selectorOrElement);
    return query(selectorOrElement, scope);
  };
  const contextReactive = (state) => {
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
    on: (eventTarget, type, listener, options) => (
      withEvents(eventTarget ?? createNullElement()).on(type, listener, options)
    ),
  };
  const cleanups = [];
  const reactiveDisposers = [];
  const execute = async (task) => {
    beginBindingCollection(target, reactiveDisposers);
    try {
      const cleanup = await task();
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    } finally {
      endBindingCollection();
    }
  };
  try {
    for (const script of scripts) {
      await execute(() => new AsyncFunction('root', 'kniusystem', script.textContent)(target, templateKniuSystem));
    }
    if (typeof mountController === 'function') {
      await execute(() => mountController(templateKniuSystem, target));
    }
  } catch (error) {
    cleanups.reverse().forEach((cleanup) => cleanup());
    reactiveDisposers.reverse().forEach((dispose) => dispose());
    throw error;
  }

  return () => {
    cleanups.reverse().forEach((cleanup) => cleanup());
    reactiveDisposers.reverse().forEach((dispose) => dispose());
  };
}
export function createTemplateApp(templateUrl, controller) {
  return {
    async mount(kniusystem, root) {
      const abortController = new AbortController();
      const dispose = await loadHtmlTemplate(
        templateUrl,
        root,
        abortController.signal,
        kniusystem,
        controller?.mount?.bind(controller),
      );
      return () => {
        abortController.abort();
        dispose?.();
      };
    }
  };
}

export function createRouteRecord(path, template, controller, initialPath) {
  return {
    path,
    template,
    initialPath,
    ...controller.data,
    app: createTemplateApp(template, controller),
  };
}

// 路由注册表：底层是数组，提供语义明确的 addRoute 注册方法。
export class RouterRegistry extends Array {
  addRoute(path, template, controller, initialPath) {
    super.push(createRouteRecord(path, template, controller, initialPath));
    return this;
  }
}

// 全局共享的路由单例。router.js 通过 import 该实例并 addRoute 注册，
// base.mjs 再 import 同一实例供运行时消费。
export const ROUTER = new RouterRegistry();
