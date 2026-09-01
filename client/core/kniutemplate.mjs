import { nextTick, queueJob } from './kniuscheduler.mjs';

var KniuTemplate = (function () {
  const SUBS = Symbol('kniu-subs');
  const IS_REACTIVE = Symbol('kniu-is-reactive');
  const ITERATE = Symbol('kniu-iterate');
  const proxyCache = new WeakMap();
  const changeObservers = new WeakMap();
  const expressionCache = new Map();
  const EXPRESSION_CACHE_LIMIT = 1000;
  let activeReadCollector = null;
  let binding = false;

  function isObject(v) {
    return v !== null && typeof v === 'object';
  }

  function getPath(state, path) {
    return String(path)
      .split('.')
      .reduce(function (obj, key) { return obj == null ? obj : obj[key]; }, state);
  }

  function setPath(state, path, value) {
    const parts = String(path).split('.');
    let obj = state;
    for (let i = 0; i < parts.length - 1; i++) {
      if (obj == null) return;
      obj = obj[parts[i]];
    }
    if (obj != null) obj[parts[parts.length - 1]] = value;
  }

  function makeScope(base, extra) {
    const accessed = [];
    const wrap = function (obj, prefix) {
      if (obj === null || typeof obj !== 'object') return obj;
      if (obj instanceof Date || obj instanceof Node) return obj;
      if (Array.isArray(obj)) return obj;
      return new Proxy(obj, {
        has(_, key) {
          if (key === Symbol.unscopables) return false;
          return typeof key === 'string';
        },
        get(_, key) {
          if (key === Symbol.unscopables) return undefined;
          if (typeof key !== 'string') return obj[key];
          if (prefix === '' && extra && key in extra) {
            accessed.push(key);
            return extra[key];
          }
          const full = prefix ? prefix + '.' + key : key;
          accessed.push(full);
          const v = obj[key];
          if (v === undefined) return globalThis[key];
          if (v === null || typeof v !== 'object') return v;
          if (v instanceof Date || v instanceof Node || Array.isArray(v)) return v;
          return wrap(v, full);
        },
      });
    };
    return { proxy: wrap(base, ''), accessed };
  }

  function looksLikeObject(e) {
    if (!e) return false;
    if (e.startsWith('{') && e.endsWith('}')) return true;
    if (e.includes('...')) return true;
    const ci = e.indexOf(':');
    if (ci !== -1) {
      const qi = e.indexOf('?');
      if ((qi === -1 || qi > ci) && e[ci + 1] !== '/') return true;
    }
    return /^[A-Za-z_$][\w$]*\s*,\s*[\s\S]+$/.test(e);
  }

  function stripBraces(raw) {
    const m = String(raw).trim().match(/^\{\{([\s\S]*)\}\}$/);
    return m ? m[1].trim() : String(raw).trim();
  }

  // kniu-form 的 options 字段对象：{ value, condition, message }。
  // 判定必须保守（value 只能是标量），否则业务对象（数组、File、DOM 节点）会被误判成字段。
  function isFormFieldObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (!('value' in value)) return false;
    const v = value.value;
    return v === null || v === undefined
      || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
  }

  const GLOBAL_ATTRS = new Set([
    'id', 'class', 'style', 'title', 'lang', 'dir', 'tabindex', 'hidden', 'role',
    'draggable', 'contenteditable', 'translate', 'spellcheck', 'accesskey',
    'autocapitalize', 'enterkeyhint', 'inputmode', 'slot', 'part', 'exportparts',
    'is', 'inert', 'popover',
  ]);

  const ATTR_TAGS = {
    href: ['a', 'area', 'base', 'link'],
    src: ['img', 'script', 'iframe', 'audio', 'video', 'source', 'track', 'embed', 'input', 'kniu-image'],
    srcset: ['img', 'source'],
    alt: ['img', 'area', 'input'],
    value: ['input', 'textarea', 'button', 'option', 'li', 'meter', 'progress', 'param'],
    type: ['input', 'button', 'script', 'link', 'source', 'ol', 'menu', 'a', 'form', 'embed', 'object'],
    name: ['button', 'fieldset', 'form', 'iframe', 'input', 'object', 'output', 'select', 'textarea', 'map', 'meta', 'param'],
    placeholder: ['input', 'textarea'],
    disabled: ['button', 'input', 'select', 'textarea', 'optgroup', 'fieldset', 'option'],
    checked: ['input'],
    selected: ['option'],
    readonly: ['input', 'textarea'],
    required: ['input', 'textarea', 'select'],
    multiple: ['input', 'select'],
    min: ['input', 'meter', 'progress'],
    max: ['input', 'meter', 'progress'],
    minlength: ['input', 'textarea'],
    maxlength: ['input', 'textarea'],
    pattern: ['input'],
    step: ['input'],
    accept: ['input'],
    capture: ['input'],
    list: ['input'],
    autocomplete: ['input', 'form', 'select', 'textarea'],
    autofocus: ['button', 'input', 'select', 'textarea'],
    target: ['a', 'form', 'base'],
    rel: ['a', 'link', 'area'],
    hreflang: ['a', 'link'],
    download: ['a', 'area'],
    ping: ['a', 'area'],
    referrerpolicy: ['a', 'area', 'iframe', 'img', 'link', 'script'],
    width: ['img', 'canvas', 'embed', 'iframe', 'input', 'object', 'source', 'svg', 'video', 'col'],
    height: ['img', 'canvas', 'embed', 'iframe', 'input', 'object', 'source', 'svg', 'video', 'col'],
    colspan: ['td', 'th'],
    rowspan: ['td', 'th'],
    for: ['label', 'output'],
    form: ['button', 'fieldset', 'input', 'label', 'object', 'output', 'select', 'textarea'],
    poster: ['video'],
    preload: ['audio', 'video'],
    controls: ['audio', 'video'],
    autoplay: ['audio', 'video'],
    loop: ['audio', 'video'],
    muted: ['audio', 'video'],
    datetime: ['time', 'ins', 'del'],
    cite: ['blockquote', 'del', 'ins', 'q'],
  };

  const SPECIAL_KNIU = new Set([
    'model',
    'options',
    'rules',
    'for', 'if', 'elseif', 'else',
    'for-index', 'for-item', 'key',
    'loading',
  ]);

  const BOOLEAN_ATTRS = new Set([
    'checked', 'disabled', 'hidden', 'selected', 'readonly', 'multiple',
    'required', 'autofocus', 'defer', 'ismap', 'novalidate', 'open',
    'reversed', 'itemscope', 'allowfullscreen', 'async', 'inert', 'default',
  ]);

  function isBooleanAttr(name) {
    return BOOLEAN_ATTRS.has(name);
  }

  function isValidForTag(attr, tag) {
    if (GLOBAL_ATTRS.has(attr)) return true;
    if (attr.startsWith('data-') || attr.startsWith('aria-')) return true;
    const tags = ATTR_TAGS[attr];
    if (!tags) return false;
    return tags.includes(tag);
  }

  const EVENT_TAGS = {
    click: '*', dblclick: '*', mousedown: '*', mouseup: '*', mousemove: '*',
    mouseover: '*', mouseout: '*', mouseenter: '*', mouseleave: '*',
    contextmenu: '*', wheel: '*',
    keydown: '*', keyup: '*', keypress: '*',
    focusin: '*', focusout: '*',
    drag: '*', dragstart: '*', dragend: '*', dragenter: '*', dragover: '*', dragleave: '*', drop: '*',
    pointerdown: '*', pointerup: '*', pointermove: '*', pointerover: '*', pointerout: '*', pointerenter: '*', pointerleave: '*',
    touchstart: '*', touchend: '*', touchmove: '*', touchcancel: '*',
    animationstart: '*', animationend: '*', animationiteration: '*', transitionend: '*',
    select: '*',
    input: ['input', 'textarea', 'select', 'button', 'kniu-input', 'kniu-switch', 'kniu-select', 'kniu-radio-group', 'kniu-upload', 'kniu-editor', 'kniu-date-picker'],
    change: ['input', 'textarea', 'select', 'button', 'kniu-input', 'kniu-switch', 'kniu-select', 'kniu-radio-group', 'kniu-upload', 'kniu-editor', 'kniu-date-picker'],
    submit: ['form', 'kniu-form'],
    reset: ['form'],
    focus: ['input', 'select', 'textarea', 'button', 'a', 'area', 'iframe', 'object'],
    blur: ['input', 'select', 'textarea', 'button', 'a', 'area', 'iframe', 'object'],
    invalid: ['input', 'select', 'textarea', 'button', 'form', 'fieldset', 'object'],
    play: ['audio', 'video'], pause: ['audio', 'video'], ended: ['audio', 'video'],
    volumechange: ['audio', 'video'], timeupdate: ['audio', 'video'],
    loadeddata: ['audio', 'video', 'img'], canplay: ['audio', 'video', 'img'],
    load: ['img', 'iframe', 'link', 'script', 'body'], error: ['img', 'iframe', 'link', 'script', 'object'],
    progress: ['progress'],
  };

  function isValidEventForTag(event, tag) {
    const allowed = EVENT_TAGS[event];
    if (!allowed) return true;
    if (allowed === '*') return true;
    return allowed.includes((tag || '').toLowerCase());
  }

  const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'poster', 'srcset']);

  function isDangerousUrl(v) {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    if (/^(javascript|vbscript):/i.test(s)) return true;
    if (/^data:/i.test(s) && !/^data:image\//i.test(s)) return true;
    return false;
  }

  const BLOCKED_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style', 'base', 'form']);

  function sanitizeNode(node) {
    [...node.children].forEach(function (el) {
      const tag = el.tagName.toLowerCase();
      if (BLOCKED_TAGS.has(tag)) {
        el.remove();
        return;
      }
      [...el.attributes].forEach(function (a) {
        const n = a.name.toLowerCase();
        if (n.startsWith('on')) {
          el.removeAttribute(a.name);
        } else if (URL_ATTRS.has(n) && isDangerousUrl(a.value)) {
          el.removeAttribute(a.name);
        } else if (n === 'srcdoc' || n === 'formaction') {
          el.removeAttribute(a.name);
        }
      });
      sanitizeNode(el);
    });
  }

  function sanitizeHtmlRegex(html) {
    let out = String(html)
      .replace(/<\s*(script|iframe|object|embed|link|meta|style|base|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(script|iframe|object|embed|link|meta|style|base|form)\b[^>]*\/?>/gi, '');
    out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    out = out.replace(/(href|src|xlink:href|poster|srcset)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '');
    return out;
  }

  function sanitizeHtml(html) {
    const D = typeof document !== 'undefined' ? document : null;
    if (D && D.createElement) {
      try {
        const tpl = D.createElement('template');
        tpl.innerHTML = html;
        sanitizeNode(tpl.content);
        return tpl.innerHTML;
      } catch {

      }
    }
    return sanitizeHtmlRegex(html);
  }

  function setAttr(node, name, value, isBool) {
    if (isBool) {
      if (value && !node.hasAttribute(name)) node.setAttribute(name, '');
      else if (!value && node.hasAttribute(name)) node.removeAttribute(name);
      return;
    }
    if (name === 'value') {
      const next = value == null ? '' : value;
      if ('value' in node) {
        if (!Object.is(node.value, next) && node.value !== String(next)) node.value = next;
      } else if (node.getAttribute('value') !== String(next)) node.setAttribute('value', String(next));
      return;
    }
    if (value == null || value === false) {
      if (node.hasAttribute(name)) node.removeAttribute(name);
      return;
    }
    if (URL_ATTRS.has(name) && isDangerousUrl(String(value))) {
      warn(`kniu:${name} 的 URL 含危险协议（${value}），已拒绝写入以防 XSS`);
      node.removeAttribute(name);
      return;
    }
    const next = String(value);
    if (node.getAttribute(name) !== next) node.setAttribute(name, next);
  }

  function warn(msg) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[kniutemplate] ' + msg);
  }

  function compileExpression(expr) {
    const e = String(expr).trim();
    let fn = expressionCache.get(e);
    if (fn === undefined) {
      const forms = looksLikeObject(e)
        ? [`with(__s){ return ({${e}}); }`, `with(__s){ return (${e}); }`]
        : [`with(__s){ return (${e}); }`, `with(__s){ return ({${e}}); }`];
      fn = null;
      for (const body of forms) {
        try {
          fn = new Function('__s', body);
          break;
        } catch {
          fn = null;
        }
      }
      if (expressionCache.size >= EXPRESSION_CACHE_LIMIT) {
        expressionCache.delete(expressionCache.keys().next().value);
      }
      expressionCache.set(e, fn);
    }
    return fn;
  }

  function evalExpr(expr, base, extra) {
    const e = String(expr).trim();
    const fn = compileExpression(e);
    if (!fn) return { value: '', paths: [] };
    const { proxy, accessed } = makeScope(base, extra);
    let value;
    try {
      value = fn(proxy);
    } catch {
      value = '';
    }
    return { value, paths: accessed };
  }

  function precompileTemplate(root) {
    if (!root || typeof document === 'undefined') return 0;
    const expressions = new Set();
    const collectText = function (value) {
      const pattern = /\{\{\s*([\s\S]*?)\s*\}\}/g;
      let match;
      while ((match = pattern.exec(String(value || '')))) {
        const raw = match[1].trim();
        expressions.add(raw.startsWith('@') ? raw.slice(1).trim() : raw);
      }
    };
    const nodes = [root];
    if (root.querySelectorAll) nodes.push(...root.querySelectorAll('*'));
    nodes.forEach(function (node) {
      if (node.nodeType === 3) {
        collectText(node.nodeValue);
        return;
      }
      if (node.nodeType !== 1) return;
      [...node.attributes].forEach(function (attribute) {
        collectText(attribute.value);
        if (attribute.name.startsWith('kniu@') && !attribute.value.includes('{{')) {
          expressions.add(attribute.value.trim());
        } else if (attribute.name.startsWith('kniu:') && !attribute.value.includes('{{')) {
          expressions.add(stripBraces(attribute.value));
        }
      });
      if (node.tagName === 'TEMPLATE' && node.content) {
        precompileTemplate(node.content);
      }
    });
    expressions.forEach(compileExpression);
    return expressions.size;
  }

  let lazyProxyDepth = 0;

  function lazyReactive(value) {
    lazyProxyDepth++;
    try {
      return reactive(value);
    } finally {
      lazyProxyDepth--;
    }
  }

  function reactive(target) {
    if (!isObject(target)) return target;
    // File/Blob 等浏览器原生对象依赖内部槽，不能被 Proxy 包装；否则
    // URL.createObjectURL、FormData 以及文件身份比较都会失效。
    if (target instanceof Date
      || (typeof Node !== 'undefined' && target instanceof Node)
      || (typeof Blob !== 'undefined' && target instanceof Blob)) return target;
    if (target[IS_REACTIVE]) return target;
    if (proxyCache.has(target)) return proxyCache.get(target);
    const subscribers = new Map();
    Object.defineProperty(target, SUBS, {
      value: subscribers,
      enumerable: false,
      configurable: true,
    });

    const handler = {
      get(obj, key) {
        if (activeReadCollector && key !== SUBS && key !== IS_REACTIVE) {
          let keys = activeReadCollector.get(proxy);
          if (!keys) {
            keys = new Set();
            activeReadCollector.set(proxy, keys);
          }
          keys.add(key);
        }
        if (key === SUBS) return subscribers;
        if (key === IS_REACTIVE) return true;
        const val = obj[key];
        // 惰性代理（get handler 内的 reactive）：绝不触发 auto-bind。
        // auto-bind 只保留给用户显式调用 reactive()（如 setup 的 state）。
        // 否则 execute 同步段内（currentScope 非 null）首次访问任意嵌套对象
        // （如 AUTH.getUser() 的 user、state.articleTable）都会以该对象为 base
        // 对整棵视图树重新 applyBindings——防御虽挡了 options 写入，但会无条件
        // 移除 kniu:options / kniu:model 属性，后续正确的 state 绑定无从处理
        // （2026-09-01 修复：无 kniu_user 时 /system 响应后 setUser 才写入 user，
        // setup 首访撞上 currentScope，articledetail 表格 options 变 {}）。
        return isObject(val) ? lazyReactive(val) : val;
      },
      set(obj, key, value) {
        const had = Object.prototype.hasOwnProperty.call(obj, key);
        const old = obj[key];
        obj[key] = value;
        if (!Object.is(old, value)) {
          const set = subscribers.get(key);
          if (set) [...set].forEach(function (fn) { queueJob(fn); });
          const observers = changeObservers.get(proxy);
          const keyed = observers && observers.get(key);
          if (keyed) [...keyed].forEach(function (fn) { queueJob(fn); });
          const iterators = !had && observers && observers.get(ITERATE);
          if (iterators) [...iterators].forEach(function (fn) { queueJob(fn); });
        }
        return true;
      },
      deleteProperty(obj, key) {
        const had = Object.prototype.hasOwnProperty.call(obj, key);
        const old = obj[key];
        const ok = delete obj[key];
        if (had) {
          const set = subscribers.get(key);
          if (set) [...set].forEach(function (fn) { queueJob(fn); });
          const observers = changeObservers.get(proxy);
          const keyed = observers && observers.get(key);
          if (keyed) [...keyed].forEach(function (fn) { queueJob(fn); });
          const iterators = observers && observers.get(ITERATE);
          if (iterators) [...iterators].forEach(function (fn) { queueJob(fn); });
        }
        return ok;
      },
      ownKeys(obj) {
        if (activeReadCollector) {
          let keys = activeReadCollector.get(proxy);
          if (!keys) {
            keys = new Set();
            activeReadCollector.set(proxy, keys);
          }
          keys.add(ITERATE);
        }
        return Reflect.ownKeys(obj);
      },
    };

    const proxy = new Proxy(target, handler);
    proxyCache.set(target, proxy);

    if (currentScope && !binding && lazyProxyDepth === 0) {
      binding = true;
      try {
        const { dispose } = bind(currentScope, proxy);
        currentCollector?.push(dispose);
      } finally {
        binding = false;
      }
    }
    return proxy;
  }

  function observe(target, key, listener) {
    if (!target || !target[IS_REACTIVE] || typeof listener !== 'function') return function () { };
    let observers = changeObservers.get(target);
    if (!observers) {
      observers = new Map();
      changeObservers.set(target, observers);
    }
    let listeners = observers.get(key);
    if (!listeners) {
      listeners = new Set();
      observers.set(key, listeners);
    }
    listeners.add(listener);
    return function () {
      listeners.delete(listener);
      if (listeners.size === 0) observers.delete(key);
      if (observers.size === 0) changeObservers.delete(target);
    };
  }

  function collectReactiveReads(getter) {
    const dependencies = new Map();
    const previous = activeReadCollector;
    activeReadCollector = dependencies;
    let value;
    try { value = getter(); } finally { activeReadCollector = previous; }
    return { value: value, dependencies: dependencies };
  }

  let currentScope = null;
  let currentCollector = null;

  function beginBindingCollection(scope, collector) {
    currentScope = scope;
    currentCollector = collector;
  }
  function endBindingCollection() {
    currentScope = null;
    currentCollector = null;
  }

  // kniu:loading 指令所需的遮罩样式（含 spinner 动画），全局注入一次
  let _kniuLoadingStyleInjected = false;
  function ensureLoadingStyle() {
    if (_kniuLoadingStyleInjected) return;
    if (typeof document === 'undefined') return;
    if (document.getElementById('kniu_loading_directive_style')) {
      _kniuLoadingStyleInjected = true;
      return;
    }
    const style = document.createElement('style');
    style.id = 'kniu_loading_directive_style';
    style.textContent = [
      '.kniu_loading_mask{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:8px;background:#fff;',
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;visibility:hidden;pointer-events:none;',
      'transition:opacity .4s ease,visibility .4s ease}',
      '.kniu_loading_mask[data-active="true"]{opacity:1;visibility:visible;pointer-events:auto;transition:none}',
      '.kniu_loading_mask--body{position:fixed}',
      '.kniu_loading_spinner{width:34px;height:34px;box-sizing:border-box;border:3px solid rgba(64,158,255,.25);',
      'border-top-color:#409eff;border-radius:50%;animation:kniu_loading_directive_spin .7s linear infinite}',
      '.kniu_loading_text{font-size:13px;color:#606266;max-width:80%;text-align:center}',
      '@keyframes kniu_loading_directive_spin{to{transform:rotate(360deg)}}',
      '@media (prefers-reduced-motion:reduce){.kniu_loading_spinner{animation:none}}'
    ].join('');
    document.head.appendChild(style);
    _kniuLoadingStyleInjected = true;
  }

  function bind(scope, source, refs) {
    precompileTemplate(scope);
    let state;
    if (source && source[IS_REACTIVE]) {
      state = source;
    } else {
      binding = true;
      try {
        state = reactive(source);
      } finally {
        binding = false;
      }
    }

    const subscriptions = [];
    const listeners = [];
    const listDisposers = [];

    const subscribePath = function (target, path, fn, cleanups = subscriptions) {
      const parts = String(path).split('.');
      let obj = target;
      for (let i = 0; i < parts.length; i++) {
        if (obj == null) break;
        const subs = obj[SUBS];
        if (subs) {
          if (!subs.has(parts[i])) subs.set(parts[i], new Set());
          const set = subs.get(parts[i]);
          set.add(fn);
          cleanups.push(function () { return set.delete(fn); });
        }
        if (i < parts.length - 1) obj = obj[parts[i]];
      }
    };

    const hasAncestor = function (node, selector) {
      let p = node.parentElement;
      while (p) {
        if (p.matches(selector)) return true;
        p = p.parentElement;
      }
      return false;
    };

    const applyBindings = function (root, base, extra, bucket, refs) {
      const resolve = function (key) { return evalExpr(key, base, extra).value; };
      const subscribe = function (key, fn) {
        evalExpr(key, base, extra).paths.forEach(function (p) { return subscribePath(base, p, fn, bucket); });
      };
      const write = function (key, value) { return setPath(base, key, value); };
      const collectBindingNodes = function (container) {
        const elements = [...container.querySelectorAll('*')];
        const templateElements = [];
        elements.filter(function (element) { return element.tagName === 'TEMPLATE'; }).forEach(function (template) {
          const isControlFlow = template.hasAttribute('kniu:for') || template.hasAttribute('kniu:if')
            || template.hasAttribute('kniu:elseif') || template.hasAttribute('kniu:else');
          if (isControlFlow) return;
          const tableColumn = template.closest('kniu-table-col');
          [...template.content.querySelectorAll('*')].forEach(function (element) {
            if (tableColumn) element.__kniuTableColumn = tableColumn;
            templateElements.push(element);
          });
        });
        return [container, ...elements, ...templateElements];
      };

      const TEXT_RE = /\{\{\s*([\s\S]*?)\s*\}\}/g;
      const rawNodes = new WeakMap();
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let _tn;
      while ((_tn = walk.nextNode())) {
        const textNode = _tn;
        if (hasAncestor(textNode, '[kniu\\:for],[kniu\\:if],[kniu\\:elseif],[kniu\\:else]')) continue;
        const text = textNode.nodeValue;
        if (!text.includes('{{')) continue;
        const segments = [];
        let last = 0;
        let m;
        TEXT_RE.lastIndex = 0;
        while ((m = TEXT_RE.exec(text))) {
          if (m.index > last) segments.push({ t: 'text', v: text.slice(last, m.index) });
          const raw = m[1].trim();
          const unescape = raw.startsWith('@');
          const expr = unescape ? raw.slice(1).trim() : raw;
          segments.push({ t: 'key', k: expr, raw: unescape });
          last = m.index + m[0].length;
        }
        if (last < text.length) segments.push({ t: 'text', v: text.slice(last) });
        const hasRaw = segments.some(function (s) { return s.t === 'key' && s.raw; });
        if (!hasRaw) {
          const render = function () {
            const next = segments
              .map(function (s) { return s.t === 'text' ? s.v : String(resolve(s.k) ?? ''); })
              .join('');
            if (textNode.nodeValue !== next) textNode.nodeValue = next;
            return next;
          };
          render();
          segments.filter(function (s) { return s.t === 'key'; }).forEach(function (s) { return subscribe(s.k, render); });
        } else {
          let previousRaw = null;
          const render = function () {
            const parent = textNode.parentNode;
            if (!parent) return;
            const values = segments.map(function (segment) {
              return segment.t === 'text' ? segment.v : String(resolve(segment.k) ?? '');
            });
            const signature = JSON.stringify(values);
            if (signature === previousRaw) return;
            previousRaw = signature;
            if (rawNodes.has(textNode)) {
              rawNodes.get(textNode).forEach(function (n) { return n.remove(); });
              rawNodes.delete(textNode);
            }
            const built = [];
            segments.forEach(function (s, index) {
              if (s.t === 'text') {
                built.push(document.createTextNode(s.v));
              } else if (!s.raw) {
                built.push(document.createTextNode(values[index]));
              } else {
                const span = document.createElement('span');
                span.innerHTML = sanitizeHtml(values[index]);
                built.push(span);
              }
            });
            const frag = document.createDocumentFragment();
            built.forEach(function (n) { return frag.appendChild(n); });
            parent.insertBefore(frag, textNode);
            textNode.nodeValue = '';
            rawNodes.set(textNode, built);
          };
          render();
          segments.filter(function (s) { return s.t === 'key'; }).forEach(function (s) { return subscribe(s.k, render); });
        }
      }

      if (root.nodeType === 1 || root.nodeType === 11) {
        const nodes = collectBindingNodes(root);
        nodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.hasAttribute('kniu:for') || node.hasAttribute('kniu:if') || node.hasAttribute('kniu:elseif') || node.hasAttribute('kniu:else')) {
            // 表格列模板（<kniu-table-col><template #default>）内的节点带 kniu:if 时，
            // 显示由 kniu-table 的 condition 机制按行求值（resolveTableRowTemplate，作用域仅
            // scope.row / $index），kniu:if 属性不会被 setupIf 处理（content 在 DocumentFragment）。
            // 但这类节点的事件绑定（kniu-btn 的 kniu@click、kniu-switch 的 kniu@change）仍需在此
            // 绑定，否则列内条件按钮永远无 handler。非列模板的普通控制流节点仍整体跳过，
            // 交给 setupIf / setupFor 渲染。
            if (!node.__kniuTableColumn) return;
          }
          if (hasAncestor(node, '[kniu\\:for],[kniu\\:if],[kniu\\:elseif],[kniu\\:else]')) return;

          const refAttr = node.hasAttribute('kniu:ref') ? 'kniu:ref' : (node.hasAttribute('ref') ? 'ref' : '');
          // ref 收集只发生在「显式 bind」（controller mount 传入 refs）时：
          // reactive() auto-bind（setup/脚本阶段的 bind(currentScope, proxy)）不带 refs，
          // 若在此收集会把 ref 写进一次性对象并移除 DOM 属性，导致后续显式 bind 永远收不到。
          if (refAttr && refs) {
            const refName = node.getAttribute(refAttr);
            if (refName) refs[refName] = node;
            node.removeAttribute(refAttr);
          }

          if (node.hasAttribute('kniu:model')) {
            const rawPath = stripBraces(node.getAttribute('kniu:model'));
            const isBool = node.type === 'checkbox' || node.type === 'radio';
            // kniu:model 指向 kniu-form options 的字段对象（{ value, condition, message }）时，
            // 双向绑定落到字段的 value 上：控件显示值、回写值，options 结构本身不动。
            // 例：kniu:model="{{userFormOptions.name}}" === kniu:model="{{userFormOptions.name.value}}"
            const fieldObject = isFormFieldObject(resolve(rawPath));
            const path = fieldObject ? `${rawPath}.value` : rawPath;
            const render = function () {
              const v = resolve(path);
              if (isBool) {
                const next = Boolean(v);
                if (node.checked !== next) node.checked = next;
              } else {
                const next = v ?? '';
                if (node.value !== String(next)) node.value = next;
              }
            };
            render();
            subscribe(path, render);
            // 字段对象被整体替换（options.name = {...}）时 rawPath 层也会通知，此处一并订阅保证刷新
            if (fieldObject) subscribe(rawPath, render);
            const onInput = function () { return write(path, isBool ? node.checked : node.value); };
            const evt = isBool ? 'change' : 'input';
            node.addEventListener(evt, onInput);
            listeners.push([node, evt, onInput]);
            node.removeAttribute('kniu:model');
            if (fieldObject) node.__kniuModelPath = rawPath;
          }

          if (node.hasAttribute('kniu:options')) {
            const expr = stripBraces(node.getAttribute('kniu:options'));
            // 自定义元素可能尚未升级：列模板 content 内的节点（如 <kniu-table-col><template>
            // 里的 kniu-switch）从未插入文档，customElements 自动升级与手动 upgrade 均不生效
            // （Chrome 对 disconnected 节点 upgrade 静默无效），'options' in node 为 false。
            // 已定义组件但未升级时，把 options 值存到 expando（__kniuOptionsValue），
            // kniu-table 的 _readColumns 读取列内 switch 快照时回退读取；已升级节点走 property。
            const tag = node.tagName.toLowerCase();
            const componentCtor = tag.includes('-') && typeof customElements !== 'undefined'
              ? customElements.get(tag) : null;
            const isUnupgradedComponent = !!componentCtor && !(node instanceof componentCtor);
            const renderOptions = function () {
              const value = resolve(expr);
              // 只有解析出真实对象才写入；解析不到（undefined/null/非对象）时保持原值，
              // 防止重复/伪绑定（如异步间隙里用数据对象当 state 的 auto-bind）把
              // 已写入的 expando 覆盖成 {}（2026-09-01 修复）。
              if (value && typeof value === 'object') {
                if ('options' in node) node.options = value;
                else if (isUnupgradedComponent) node.__kniuOptionsValue = value;
                else warn(`kniu:options 不能用在 <${node.tagName.toLowerCase()}> 上（组件未提供 options property）。`);
              }
            };
            renderOptions();
            subscribe(expr, renderOptions);
            // 列模板内节点（__kniuTableColumn）刻意保留 kniu:options 属性：kniu:if / kniu:for
            // 克隆列时 expando 不随 cloneNode 复制，保留属性让克隆列在递归 applyBindings 中
            // 重新解析并写入 expando（与 kniu@change 同策略，见本文件事件绑定处注释）；
            // 普通节点直接移除属性，避免二次绑定重复订阅。
            if (!node.__kniuTableColumn) node.removeAttribute('kniu:options');
          }

          // kniu:rules 已随 kniu-form 的 options 化重构作废（2026-09-01）：
          // 字段验证统一写在 kniu:options 里——字段对象带 condition 即需验证，message 为提示。
          if (node.hasAttribute('kniu:rules')) {
            warn('kniu:rules 已作废，请改用 kniu:options，在字段上声明 value / condition / message。');
            node.removeAttribute('kniu:rules');
          }

          // kniu:loading 指令：区域 / 全屏加载遮罩。
          // 用法：
          //   kniu:loading="{{loading}}"        遮罩作为绑定元素子节点（区域加载，元素需为定位上下文）
          //   kniu:loading.body="{{loading}}"  遮罩插入 document.body（全屏加载）
          //   可选 kniu:loading-text="{{tip}}"  遮罩文案
          const loadingAttr = [...node.attributes].find(function (a) {
            return a.name === 'kniu:loading' || a.name === 'kniu:loading.body';
          });
          if (loadingAttr) {
            const body = loadingAttr.name === 'kniu:loading.body';
            const loadingExpr = stripBraces(loadingAttr.value);
            const hasText = node.hasAttribute('kniu:loading-text');
            const textExpr = hasText ? stripBraces(node.getAttribute('kniu:loading-text')) : '';
            if (hasText) node.removeAttribute('kniu:loading-text');
            node.removeAttribute('kniu:loading');
            node.removeAttribute('kniu:loading.body');

            // 委托检测：绑定元素是自带 loading 的 Shadow DOM 自定义组件（如 kniu-table）时，
            // 不再往光层塞遮罩（光层子节点无 <slot> 不会渲染），而是直接驱动组件内置遮罩，
            // 由组件自身管理遮罩，避免光层节点无法显示。
            // 仅「区域加载」(kniu:loading) 委托；kniu:loading.body 仍走全屏遮罩。
            const delegate = !body && node.shadowRoot
              && typeof node.tagName === 'string'
              && node.tagName.toLowerCase().indexOf('kniu-') === 0
              && 'loading' in node;

            if (delegate) {
              const render = function () {
                node.loading = Boolean(resolve(loadingExpr));
                if (textExpr) node.loadingText = resolve(textExpr);
              };
              render();
              subscribe(loadingExpr, render);
              if (textExpr) subscribe(textExpr, render);
              // 组件自管理遮罩，无需 disposer
            } else {
              ensureLoadingStyle();
              const mask = document.createElement('div');
              mask.className = 'kniu_loading_mask' + (body ? ' kniu_loading_mask--body' : '');
              mask.setAttribute('data-active', 'false');
              const spinner = document.createElement('span');
              spinner.className = 'kniu_loading_spinner';
              mask.appendChild(spinner);
              const textEl = document.createElement('span');
              textEl.className = 'kniu_loading_text';
              mask.appendChild(textEl);

              let mounted = false;
              const mount = function () {
                if (mounted) return;
                if (body) {
                  document.body.appendChild(mask);
                } else {
                  const pos = getComputedStyle(node).position;
                  if (pos === 'static') node.style.position = 'relative';
                  node.appendChild(mask);
                }
                mounted = true;
              };
              const unmount = function () {
                if (!mounted) return;
                if (mask.parentNode) mask.parentNode.removeChild(mask);
                mounted = false;
              };

              const render = function () {
                const active = Boolean(resolve(loadingExpr));
                if (active) {
                  mount();
                  mask.setAttribute('data-active', 'true');
                } else {
                  mask.setAttribute('data-active', 'false');
                }
                if (textExpr) {
                  const t = resolve(textExpr);
                  textEl.textContent = t == null ? '' : String(t);
                }
              };
              render();
              subscribe(loadingExpr, render);
              if (textExpr) subscribe(textExpr, render);
              // 卸载时清理遮罩，避免 body 挂载泄漏
              listDisposers.push(unmount);
            }
          }

          const DATA_ATTR_RE = /^kniu:\[([a-z][a-z0-9-]*)\]$/i;
          [...node.attributes].forEach(function (attr) {
            const match = attr.name.match(DATA_ATTR_RE);
            if (!match) return;
            const bindingName = match[1].toLowerCase();
            const dataAttrName = `data-${bindingName}`;
            const propertyName = bindingName.replace(/-([a-z0-9])/g, function (_, char) {
              return char.toUpperCase();
            });
            const bindsComponentProperty = node.tagName.includes('-') && propertyName in node;
            const expr = stripBraces(attr.value);
            const render = function () {
              const { value } = evalExpr(expr, base, extra);
              if (bindsComponentProperty) {
                if (!Object.is(node[propertyName], value)) node[propertyName] = value;
              } else if (value == null || value === false) {
                if (node.hasAttribute(dataAttrName)) node.removeAttribute(dataAttrName);
              } else {
                const next = String(value);
                if (node.getAttribute(dataAttrName) !== next) node.setAttribute(dataAttrName, next);
              }
            };
            render();
            subscribe(expr, render);
            node.removeAttribute(attr.name);
          });

          [...node.attributes].forEach(function (attr) {
            const full = attr.name;
            if (!full.startsWith('kniu:')) return;
            const key = full.slice(5);
            if (SPECIAL_KNIU.has(key)) return;
            const attrName = key;
            const tag = node.tagName.toLowerCase();
            if (!isValidForTag(attrName, tag)) {
              warn(`kniu:${attrName} 不能用在 <${tag}> 上（该元素不支持属性 "${attrName}"）；自定义 data-* 属性请改用 kniu:[name]。`);
              node.removeAttribute(full);
              return;
            }
            const expr = stripBraces(attr.value);
            const isBool = isBooleanAttr(attrName);
            const render = function () {
              const v = resolve(expr);
              setAttr(node, attrName, v, isBool);
            };
            render();
            subscribe(expr, render);
            node.removeAttribute(full);
          });

          const EVENT_RE = /^kniu@([a-z][a-z0-9-]*)(?:\.([a-z0-9.]+))?$/i;
          const EVENT_OPTION_MODIFIERS = new Set(['capture', 'once', 'passive', 'native']);
          const EVENT_BEHAVIOR_MODIFIERS = new Set([
            'prevent', 'stop', 'self', 'ctrl', 'shift', 'alt', 'meta', 'exact',
            'left', 'right', 'middle', 'enter', 'tab', 'delete', 'esc', 'space',
            'up', 'down'
          ]);
          const KEY_MODIFIER_VALUES = {
            enter: ['Enter'],
            tab: ['Tab'],
            delete: ['Backspace', 'Delete'],
            esc: ['Escape', 'Esc'],
            space: [' ', 'Spacebar'],
            up: ['ArrowUp'],
            down: ['ArrowDown'],
            left: ['ArrowLeft'],
            right: ['ArrowRight']
          };
          const eventState = new WeakMap();
          [...node.attributes].forEach(function (attr) {
            const evMatch = attr.name.match(EVENT_RE);
            if (!evMatch) return;
            const eventName = evMatch[1].toLowerCase();
            const modifiers = evMatch[2]
              ? evMatch[2].toLowerCase().split('.').filter(Boolean)
              : [];
            const unknownModifiers = modifiers.filter(function (modifier) {
              return !EVENT_OPTION_MODIFIERS.has(modifier) && !EVENT_BEHAVIOR_MODIFIERS.has(modifier);
            });
            if (unknownModifiers.length) {
              warn(`kniu@${eventName} 包含不支持的修饰符：${unknownModifiers.join(', ')}`);
              node.removeAttribute(attr.name);
              return;
            }
            if (modifiers.includes('passive') && modifiers.includes('prevent')) {
              warn(`kniu@${eventName}.passive.prevent 不能同时使用，已跳过绑定`);
              node.removeAttribute(attr.name);
              return;
            }
            const tag = node.tagName.toLowerCase();
            const insideTableColumn = node.closest('kniu-table-col') || node.__kniuTableColumn;
            const isTableScopedSwitchChange = insideTableColumn
              && node.matches('kniu-switch')
              && eventName === 'change';
            const isTableScopedButtonClick = insideTableColumn
              && node.matches('kniu-btn')
              && eventName === 'click';
            if (!isTableScopedSwitchChange && !isTableScopedButtonClick && !isValidEventForTag(eventName, tag)) {
              warn(`kniu@${eventName} 不被 <${tag}> 支持，已跳过（事件只能绑定到元素原生支持的事件上）`);
              node.removeAttribute(attr.name);
              return;
            }
            const expr = attr.value.trim();
            const tableScopedControl = insideTableColumn && (
              (node.matches('kniu-btn') && eventName === 'click')
              || (node.matches('kniu-switch') && eventName === 'change')
            );
            if (tableScopedControl) {
              const handlerMatch = expr.match(/^([A-Za-z_$][\w$]*)\s*\(/);
              const handlerName = handlerMatch?.[1] || expr;
              const columnEl = node.__kniuTableColumn || node.closest('kniu-table-col');
              const renderScopedHandler = function () {
                const { value } = evalExpr(handlerName, base, extra);
                const fn = typeof value === 'function' ? value.bind(base) : null;
                // 只在解析到真实函数时才写入。applyBindings 会随嵌套组件 / 重渲染递归执行，
                // 表格内 kniu-switch / kniu-btn 的 kniu@change / kniu@click 节点可能被「非控制器作用域」
                // 的那一轮重复处理，此时 handlerName 在 base 上解析不到（返回 undefined），fn 为 null。
                // 若无条件写入会把上一轮已绑好的提交函数覆盖成 null，导致点击开关 / 按钮不再发请求。
                // 仅当 fn 为函数时落盘，可保证最后存活的是正确的业务提交函数。
                if (fn) {
                  node.__kniuTableScopedHandler = fn;
                  if (columnEl) columnEl.__kniuTableScopedSwitchHandler = fn;
                }
                // kniu:if / kniu:for 会 clone 列节点，expando 随 cloneNode 丢失；而 _readColumns 直接读取
                // 克隆后的列宿主 / 模板内 switch，因此这里【不移除】kniu@change / kniu@click 属性，
                // 让克隆后的列在 applyBindings 时重新解析并绑定到克隆节点自身，从而保证提交函数随列存活。
                if (node.matches('kniu-switch')) {
                  // 解析 disabled 绑定（控制器作用域）：避免把 {{...}} 字面量当作属性，导致开关始终禁用
                  const disabledRaw = node.getAttribute('disabled');
                  if (disabledRaw && disabledRaw.includes('{{')) {
                    const { value: dv } = evalExpr(disabledRaw.replace(/^\{\{|\}\}$/g, '').trim(), base, extra);
                    if (dv) node.setAttribute('disabled', ''); else node.removeAttribute('disabled');
                  }
                }
              };
              renderScopedHandler();
              subscribe(handlerName, renderScopedHandler);
              // 注意：此处刻意不 removeAttribute，理由见上。kniu@change / kniu@click 不在
              // _readColumns 的 switch.attributes 白名单内，不会被复制到行内真实 switch / button。
              return;
            }
            const handlers = eventState.get(node) || new Map();
            eventState.set(node, handlers);
            const bindingKey = attr.name.toLowerCase();
            const listenerOptions = {
              capture: modifiers.includes('capture'),
              once: modifiers.includes('once'),
              passive: modifiers.includes('passive')
            };
            const render = function () {
              const { value } = evalExpr(expr, base, extra);
              if (typeof value !== 'function') {
                if (handlers.has(bindingKey)) {
                  const current = handlers.get(bindingKey);
                  node.removeEventListener(eventName, current.handler, current.options);
                  handlers.delete(bindingKey);
                }
                return;
              }
              if (handlers.has(bindingKey)) {
                const current = handlers.get(bindingKey);
                node.removeEventListener(eventName, current.handler, current.options);
              }
              const handler = function (event) {
                if (eventName === 'click' && !modifiers.includes('native') && !modifiers.includes('passive')) {
                  event.preventDefault();
                }
                const isKeyboardEvent = event.type.startsWith('key');
                const keyModifiers = isKeyboardEvent
                  ? modifiers.filter(function (modifier) {
                    return Object.prototype.hasOwnProperty.call(KEY_MODIFIER_VALUES, modifier);
                  })
                  : [];
                if (keyModifiers.length) {
                  const matched = keyModifiers.some(function (modifier) {
                    return KEY_MODIFIER_VALUES[modifier].includes(event.key);
                  });
                  if (!matched) return;
                }
                const requiredSystemKeys = new Set(modifiers.filter(function (modifier) {
                  return ['ctrl', 'shift', 'alt', 'meta'].includes(modifier);
                }));
                for (const modifier of modifiers) {
                  if (EVENT_OPTION_MODIFIERS.has(modifier) || keyModifiers.includes(modifier)) continue;
                  if (modifier === 'self' && event.target !== event.currentTarget) return;
                  if (modifier === 'ctrl' && !event.ctrlKey) return;
                  if (modifier === 'shift' && !event.shiftKey) return;
                  if (modifier === 'alt' && !event.altKey) return;
                  if (modifier === 'meta' && !event.metaKey) return;
                  if (modifier === 'exact' && (
                    event.ctrlKey !== requiredSystemKeys.has('ctrl') ||
                    event.shiftKey !== requiredSystemKeys.has('shift') ||
                    event.altKey !== requiredSystemKeys.has('alt') ||
                    event.metaKey !== requiredSystemKeys.has('meta')
                  )) return;
                  if (!isKeyboardEvent) {
                    if (modifier === 'left' && event.button !== 0) return;
                    if (modifier === 'middle' && event.button !== 1) return;
                    if (modifier === 'right' && event.button !== 2) return;
                  }
                  if (modifier === 'stop') event.stopPropagation();
                  if (modifier === 'prevent') event.preventDefault();
                }
                return value.call(base, event);
              };
              node.addEventListener(eventName, handler, listenerOptions);
              listeners.push([node, eventName, handler, listenerOptions]);
              handlers.set(bindingKey, { handler: handler, options: listenerOptions });
            };
            render();
            subscribe(expr, render);
            node.removeAttribute(attr.name);
          });
        });
      }

      if (root.nodeType === 1 || root.nodeType === 11) {
        const ATTR_RE = /\{\{\s*([\s\S]*?)\s*\}\}/g;
        const nodes = collectBindingNodes(root);
        nodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.hasAttribute('kniu:for') || node.hasAttribute('kniu:if') || node.hasAttribute('kniu:elseif') || node.hasAttribute('kniu:else')) return;
          if (hasAncestor(node, '[kniu\\:for],[kniu\\:if],[kniu\\:elseif],[kniu\\:else]')) return;
          // 表格列模板（<kniu-table-col><template #default> 内的元素）的属性插值必须交给
          // kniu-table 逐行解析（resolveTableRowTemplate 用 scope.row 求值）。若在此用控制器
          // 作用域提前求值，scope.row 不存在会把 {{ }} 解析成空值并移除属性（如 type），导致
          // type="{{scope.row.role_text == '管理员' ? 'success' : 'primary'}}" 这类按行绑定失效。
          // __kniuTableColumn 由 collectBindingNodes 深入列模板时标记，且不含列元素自身，
          // 故只跳过列模板内部元素，保留列元素自身的 on-change / editable / data 等绑定。
          if (node.__kniuTableColumn) return;
          [...node.attributes].forEach(function (attr) {
            const name = attr.name;
            if (name.startsWith('kniu:') || name.startsWith('kniu@')) return;
            const template = attr.value;
            if (!template.includes('{{')) return;
            const segments = [];
            let last = 0;
            let m;
            ATTR_RE.lastIndex = 0;
            while ((m = ATTR_RE.exec(template))) {
              if (m.index > last) segments.push({ t: 'text', v: template.slice(last, m.index) });
              segments.push({ t: 'key', k: m[1] });
              last = m.index + m[0].length;
            }
            if (last < template.length) segments.push({ t: 'text', v: template.slice(last) });
            const isBool = isBooleanAttr(name);
            const pureExpr = segments.length === 1 && segments[0].t === 'key';
            // 组件 property 透传：自定义元素上存在同名 property 时，直接写入 property（支持对象/数组/函数），与 kniu:[name] 行为一致
            const propertyName = name.replace(/-([a-z0-9])/g, function (_, char) {
              return char.toUpperCase();
            });
            const bindsComponentProperty = node.tagName.includes('-') && propertyName in node;
            const render = function () {
              const parts = segments.map(function (s) { return s.t === 'text' ? s.v : resolve(s.k); });
              if (bindsComponentProperty && pureExpr) {
                const value = resolve(segments[0].k);
                if (!Object.is(node[propertyName], value)) node[propertyName] = value;
                return;
              }
              if (isBool && pureExpr) {
                if (parts[0]) node.setAttribute(name, '');
                else node.removeAttribute(name);
                return;
              }
              if (pureExpr && (parts[0] == null || parts[0] === false)) {
                node.removeAttribute(name);
                return;
              }
              const resolved = parts.map(function (v) { return v == null ? '' : String(v); }).join('');
              if (resolved === '' && !segments.some(function (s) { return s.t === 'text'; })) {
                node.removeAttribute(name);
              } else if (URL_ATTRS.has(name) && isDangerousUrl(resolved)) {
                warn(`属性 "${name}" 的插值 URL 含危险协议，已拒绝写入以防 XSS`);
                node.removeAttribute(name);
              } else {
                if (node.getAttribute(name) !== resolved) node.setAttribute(name, resolved);
              }
            };
            render();
            segments.filter(function (s) { return s.t === 'key'; }).forEach(function (s) { return subscribe(s.k, render); });
          });
        });
      }
    }

    const setupFor = function (block, parentExtra, bucket = null) {
      const forAttr = block.getAttribute('kniu:for');
      const forMatch = forAttr.match(/\{\{([\s\S]*?)\}\}/);
      const arrayExpr = (forMatch ? forMatch[1] : forAttr).trim();
      const idxName = block.getAttribute('kniu:for-index') || 'index';
      const itemName = block.getAttribute('kniu:for-item') || 'item';
      const keyExpr = block.getAttribute('kniu:key');
      const useKeyed = !!keyExpr;
      const isTpl = block.tagName === 'TEMPLATE';
      const tpl = isTpl ? block.content : block.cloneNode(true);
      if (!isTpl) {
        tpl.removeAttribute('kniu:for');
        tpl.removeAttribute('kniu:for-index');
        tpl.removeAttribute('kniu:for-item');
        tpl.removeAttribute('kniu:key');
      }
      const anchor = document.createComment('kniu:for');
      block.replaceWith(anchor);
      let rendered = [];
      let prevViews = [];
      let subCleanups = [];
      const bc = bucket || subCleanups;

      const keyFor = function (item) {
        return keyExpr === '*this' ? item : (function () {
          const k = getPath(item, keyExpr);
          return k === undefined ? item : k;
        })();
      };

      const createView = function () {
        const viewCleanups = [];
        let initialized = false;
        let roots = null;
        const nb = useKeyed ? viewCleanups : bc;
        const update = function (extra) {
          viewCleanups.forEach(function (c) { return c(); });
          viewCleanups.length = 0;
          if (!initialized) {
            const frag = tpl.cloneNode(true);
            roots = isTpl ? [...frag.childNodes] : [frag];
            roots.forEach(function (node) {
              if (node.nodeType === 1) {
                node.querySelectorAll('[kniu\\:for]').forEach(function (n) { return setupFor(n, extra, nb); });
                node.querySelectorAll('[kniu\\:if]').forEach(function (n) { return setupIf(n, extra, nb); });
              }
              applyBindings(node, state, extra, nb, refs);
            });
            initialized = true;
          } else {
            roots.forEach(function (node) { return applyBindings(node, state, extra, nb, refs); });
          }
        };
        return { update, getNodes: function () { return roots; }, viewCleanups };
      };

      const render = function () {
        subCleanups.length = 0;
        const { value: arr, paths } = evalExpr(arrayExpr, state, parentExtra);
        paths.forEach(function (p) { return subscribePath(state, p, render, bc); });
        const list = Array.isArray(arr) ? arr : [];
        if (arr && arr[SUBS]) {
          if (!arr[SUBS].has('length')) arr[SUBS].set('length', new Set());
          const s = arr[SUBS].get('length');
          s.add(render);
          bc.push(function () { return s.delete(render); });
        }

        if (!useKeyed) {
          rendered.forEach(function (n) { return n.remove(); });
          rendered = [];
          list.forEach(function (item, index) {
            const extra = { ...parentExtra, [idxName]: index, [itemName]: item };
            const view = createView();
            view.update(extra);
            if (item && item[SUBS]) {
              for (const [, set] of item[SUBS]) {
                set.add(render);
                bc.push(function () { return set.delete(render); });
              }
            }
            view.getNodes().forEach(function (node) {
              anchor.parentNode.insertBefore(node, anchor);
              rendered.push(node);
            });
          });
          return;
        }

        const keys = list.map(function (it) { return keyFor(it); });
        const prevMap = new Map(prevViews.map(function (v) { return [v.key, v]; }));
        const usedKeys = new Set();
        const nextViews = [];
        list.forEach(function (item, index) {
          const key = keys[index];
          const extra = { ...parentExtra, [idxName]: index, [itemName]: item };
          let view = prevMap.get(key);
          if (!view) {
            view = createView();
            view.key = key;
          }
          view.update(extra);
          if (item && item[SUBS]) {
            for (const [, set] of item[SUBS]) {
              set.add(render);
              view.viewCleanups.push(function () { return set.delete(render); });
            }
          }
          usedKeys.add(key);
          nextViews.push(view);
        });
        prevViews.forEach(function (v) {
          if (!usedKeys.has(v.key)) {
            v.viewCleanups.forEach(function (c) { return c(); });
            v.getNodes().forEach(function (n) { return n.remove(); });
          }
        });
        const frag = document.createDocumentFragment();
        nextViews.forEach(function (v) { return v.getNodes().forEach(function (n) { return frag.appendChild(n); }); });
        anchor.parentNode.insertBefore(frag, anchor);
        prevViews = nextViews;
        rendered = [];
      };

      render();
      listDisposers.push(function () {
        subCleanups.forEach(function (c) { return c(); });
        rendered.forEach(function (n) { return n.remove(); });
        prevViews.forEach(function (v) {
          v.viewCleanups.forEach(function (c) { return c(); });
          v.getNodes().forEach(function (n) { return n.remove(); });
        });
      });
    };

    const setupIf = function (block, parentExtra, bucket = null) {
      const chain = [{ node: block, type: 'if' }];
      let sib = block.nextSibling;
      while (sib) {
        if (sib.nodeType === 3 && sib.nodeValue.trim() === '') {
          sib = sib.nextSibling;
          continue;
        }
        if (sib.nodeType === 1) {
          if (sib.hasAttribute('kniu:elseif')) {
            chain.push({ node: sib, type: 'elseif' });
            sib = sib.nextSibling;
            continue;
          }
          if (sib.hasAttribute('kniu:else')) {
            chain.push({ node: sib, type: 'else' });
            break;
          }
        }
        break;
      }

      const branches = chain.map(function ({ node, type }) {
        const tpl = node.cloneNode(true);
        if (type === 'if' || type === 'elseif') {
          const attrName = type === 'if' ? 'kniu:if' : 'kniu:elseif';
          const raw = node.getAttribute(attrName);
          const m = raw.match(/\{\{([\s\S]*?)\}\}/);
          const expr = (m ? m[1] : raw).trim();
          tpl.removeAttribute('kniu:if');
          tpl.removeAttribute('kniu:elseif');
          return { type, expr, tpl, value: false };
        }
        tpl.removeAttribute('kniu:else');
        return { type: 'else', expr: null, tpl, value: false };
      });

      const anchor = document.createComment('kniu:if');
      block.replaceWith(anchor);
      chain.slice(1).forEach(function ({ node }) { return node.remove(); });

      let rendered = [];
      const cleanups = [];
      const bc = bucket || cleanups;

      const render = function () {
        cleanups.length = 0;
        rendered.forEach(function (n) { return n.remove(); });
        rendered = [];
        let chosen = null;
        for (const b of branches) {
          if (b.type === 'else') {
            b.value = true;
            if (!chosen) chosen = b;
            continue;
          }
          const { value, paths } = evalExpr(b.expr, state, parentExtra);
          paths.forEach(function (p) { return subscribePath(state, p, render, bc); });
          b.value = value;
          if (b.value && !chosen) chosen = b;
        }
        if (chosen) {
          const isTpl = chosen.tpl.tagName === 'TEMPLATE';
          const frag = isTpl
            ? chosen.tpl.content.cloneNode(true)
            : chosen.tpl.cloneNode(true);
          // 模板元素插入其顶层子节点；普通元素则插入元素自身（不能丢 wrapper）。
          const nodes = isTpl ? [...frag.childNodes] : [frag];
          nodes.forEach(function (node) {
            if (node.nodeType === 1) {
              node.querySelectorAll('[kniu\\:for]').forEach(function (n) { return setupFor(n, parentExtra, bc); });
              node.querySelectorAll('[kniu\\:if]').forEach(function (n) { return setupIf(n, parentExtra, bc); });
            }
            applyBindings(node, state, parentExtra, bc, refs);
            anchor.parentNode.insertBefore(node, anchor);
            rendered.push(node);
          });
        }
      };

      render();
      listDisposers.push(function () {
        cleanups.forEach(function (c) { return c(); });
        rendered.forEach(function (n) { return n.remove(); });
      });
    };

    applyBindings(scope, state, {}, subscriptions, refs);

    [...scope.querySelectorAll('[kniu\\:for]')]
      .filter(function (b) { return !hasAncestor(b, '[kniu\\:for]'); })
      .forEach(function (b) { return setupFor(b, {}); });

    let guard = 0;
    let ifBlock;
    while (
      (ifBlock = scope.querySelector('[kniu\\:if]')) &&
      !hasAncestor(ifBlock, '[kniu\\:for]') &&
      guard++ < 1000
    ) {
      setupIf(ifBlock, {});
    }

    const orphanDirectives = [
      'kniu:elseif', 'kniu:else', 'kniu:key', 'kniu:for-index', 'kniu:for-item',
    ];
    orphanDirectives.forEach(function (name) {
      scope.querySelectorAll(`[${name.replace(':', '\\:')}]`).forEach(function (node) {
        warn(`孤立指令 ${name} 缺少对应的父级/链头指令，已移除标记属性`);
        node.removeAttribute(name);
      });
    });

    const dispose = function () {
      subscriptions.forEach(function (off) { return off(); });
      listeners.forEach(function ([node, evt, fn, options]) {
        return node.removeEventListener(evt, fn, options);
      });
      listDisposers.forEach(function (d) { return d(); });
    };
    return { state, refs, dispose };
  }

  return {
    reactive: reactive,
    observe: observe,
    collectReactiveReads: collectReactiveReads,
    compileExpression: compileExpression,
    precompileTemplate: precompileTemplate,
    nextTick: nextTick,
    beginBindingCollection: beginBindingCollection,
    endBindingCollection: endBindingCollection,
    bind: bind
  };
}());

export default KniuTemplate;
