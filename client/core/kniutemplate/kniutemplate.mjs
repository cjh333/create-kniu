import { nextTick, queueJob } from '../kniuscheduler.mjs';
import { isDangerousUrl } from '../kniusanitizer.mjs';

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

  // 模板表达式作用域的危险键：拦截原型链逃逸（constructor.constructor('…')() ⇒ 任意代码执行）
  const DANGEROUS_SCOPE_KEYS = new Set([
    'constructor', '__proto__', 'prototype', '__defineGetter__', '__defineSetter__',
    '__lookupGetter__', '__lookupSetter__',
  ]);

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
          // 原型链逃逸防护：{{ constructor.constructor('...')() }} 可从模板字符串构造任意代码，
          // 模板表达式输入源含非完全可信内容时即为 RCE/XSS——危险键一律返回 undefined。
          if (DANGEROUS_SCOPE_KEYS.has(key)) return undefined;
          if (prefix === '' && extra && key in extra) {
            accessed.push(key);
            return extra[key];
          }
          const full = prefix ? prefix + '.' + key : key;
          accessed.push(full);
          const v = obj[key];
          if (v === undefined) {
            const g = globalThis[key];
            // globalThis 兜底同样挡住危险键（如 globalThis.constructor），并只放行自有属性
            if (g === undefined || DANGEROUS_SCOPE_KEYS.has(key) || !Object.prototype.hasOwnProperty.call(globalThis, key)) return undefined;
            return g;
          }
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
    'option',
    'options',
    'rules',
    'for', 'if', 'elseif', 'else',
    'for-index', 'for-item', 'key',
    'loading',
    'style',
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

  const DEFAULT_PREVENT_EVENTS = new Set([
    'mouseenter', 'mouseleave', 'mouseover', 'mouseout', 'mousemove',
    'pointerenter', 'pointerleave', 'pointerover', 'pointerout', 'pointermove',
    'animationstart', 'animationend', 'animationiteration', 'transitionend',
  ]);

  const EVENT_OPTION_MODIFIERS = new Set(['capture', 'once', 'passive', 'native']);
  const EVENT_BEHAVIOR_MODIFIERS = new Set([
    'prevent', 'stop', 'self', 'ctrl', 'shift', 'alt', 'meta', 'exact',
    'left', 'right', 'middle', 'enter', 'tab', 'delete', 'esc', 'space',
    'up', 'down'
  ]);
  const KEY_MODIFIER_VALUES = {
    enter: ['Enter'], tab: ['Tab'], delete: ['Backspace', 'Delete'], esc: ['Escape', 'Esc'],
    space: [' ', 'Spacebar'], up: ['ArrowUp'], down: ['ArrowDown'],
    left: ['ArrowLeft'], right: ['ArrowRight']
  };

  function isValidEventForTag(event, tag) {
    const allowed = EVENT_TAGS[event];
    if (!allowed) return true;
    if (allowed === '*') return true;
    return allowed.includes((tag || '').toLowerCase());
  }

  const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'poster', 'srcset']);

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

  const SANITIZE_CACHE = new Map();
  const SANITIZE_CACHE_LIMIT = 200;

  function sanitizeHtml(html) {
    const D = typeof document !== 'undefined' ? document : null;
    if (D && D.createElement) {
      const key = String(html);
      if (SANITIZE_CACHE.has(key)) return SANITIZE_CACHE.get(key);
      try {
        const tpl = D.createElement('template');
        tpl.innerHTML = html;
        sanitizeNode(tpl.content);
        const result = tpl.innerHTML;
        if (SANITIZE_CACHE.size >= SANITIZE_CACHE_LIMIT) {
          // FIFO 淘汰最旧一项，而非全量 clear——高频不同 HTML 时保留热缓存
          SANITIZE_CACHE.delete(SANITIZE_CACHE.keys().next().value);
        }
        SANITIZE_CACHE.set(key, result);
        return result;
      } catch {

      }
    }
    return sanitizeHtmlRegex(html);
  }

  const SEMANTIC_EMPTY_ATTRS = new Set(['alt', 'title', 'placeholder', 'name', 'label']);

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
    if (value == null || value === false
      || (typeof value === 'string' && value.trim() === '' && !SEMANTIC_EMPTY_ATTRS.has(name))) {
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

  function stylePropertyName(name) {
    const raw = String(name || '');
    if (raw.startsWith('--')) return raw;
    return raw.replace(/[A-Z]/g, function (letter) { return '-' + letter.toLowerCase(); })
      .replace(/^-ms-/, '-ms-');
  }

  function normalizeStyleValue(node, value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.entries(value).map(function ([name, item]) {
        return [stylePropertyName(name), item];
      });
    }
    if (typeof value !== 'string') return [];
    const documentRef = node.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!documentRef?.createElement) return [];
    const probe = documentRef.createElement('span');
    probe.style.cssText = value;
    return Array.from(probe.style).map(function (name) { return [name, probe.style.getPropertyValue(name)]; });
  }

  function optionAttributeName(name) {
    const raw = String(name || '');
    if (raw.startsWith('data-') || raw.startsWith('aria-')) return raw;
    return 'data-' + raw.replace(/[A-Z]/g, function (letter) { return '-' + letter.toLowerCase(); });
  }

  function optionEventDescriptor(name) {
    const raw = String(name || '');
    if (!/^on[A-Z][A-Za-z0-9]*$/.test(raw)) return null;
    const eventNames = Object.keys(EVENT_TAGS).sort(function (left, right) { return right.length - left.length; });
    const matchedEvent = eventNames.find(function (eventName) {
      const eventToken = eventName.charAt(0).toUpperCase() + eventName.slice(1);
      return raw.startsWith('on' + eventToken);
    });
    if (!matchedEvent) return null;
    let suffix = raw.slice(('on' + matchedEvent.charAt(0).toUpperCase() + matchedEvent.slice(1)).length);
    const modifierTokens = [
      ['Capture', 'capture'], ['Prevent', 'prevent'], ['Passive', 'passive'], ['Native', 'native'],
      ['Middle', 'middle'], ['Delete', 'delete'], ['Exact', 'exact'], ['Shift', 'shift'],
      ['Space', 'space'], ['Right', 'right'], ['Enter', 'enter'], ['Left', 'left'],
      ['Ctrl', 'ctrl'], ['Meta', 'meta'], ['Once', 'once'], ['Self', 'self'], ['Stop', 'stop'],
      ['Alt', 'alt'], ['Tab', 'tab'], ['Esc', 'esc'], ['Down', 'down'], ['Up', 'up']
    ];
    const modifiers = [];
    while (suffix) {
      const token = modifierTokens.find(function (item) { return suffix.startsWith(item[0]); });
      if (!token) return null;
      modifiers.push(token[1]);
      suffix = suffix.slice(token[0].length);
    }
    return { eventName: matchedEvent, modifiers: modifiers };
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
    } catch (e) {
      value = '';
      // 开发模式不静默：拼错的字段名/运行时 TypeError 直接在控制台给出表达式原文与错误
      if (globalThis.__KNIU_DEV__) warn('表达式求值失败 [' + e.slice(0, 120) + ']：' + (e && e.message ? e.message : 'unknown'));
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

  let _kniuLoadingStyleInjected = false;
  function ensureLoadingStyle() {
    if (_kniuLoadingStyleInjected) return;
    if (typeof document === 'undefined') return;
    if (document.getElementById('kniu_sys_loading_directive_style')) {
      _kniuLoadingStyleInjected = true;
      return;
    }
    const style = document.createElement('style');
    style.id = 'kniu_sys_loading_directive_style';
    style.textContent = [
      '.kniu_sys_loading_mask{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:8px;background-color:#fff;',
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;visibility:hidden;pointer-events:none;',
      'transition:opacity .4s ease,visibility .4s ease}',
      '.kniu_sys_loading_mask[data-active="true"]{opacity:1;visibility:visible;pointer-events:auto;transition:none}',
      '.kniu_sys_loading_mask--body{position:fixed}',
      '.kniu_sys_loading_spinner{width:34px;height:34px;box-sizing:border-box;border:3px solid rgba(64,158,255,.25);',
      'border-top-color:#409eff;border-radius:50%;animation:kniu_sys_loading_directive_spin .7s linear infinite}',
      '.kniu_sys_loading_text{font-size:13px;color:#606266;max-width:80%;text-align:center}',
      '@keyframes kniu_sys_loading_directive_spin{to{transform:rotate(360deg)}}',
      '@media (prefers-reduced-motion:reduce){.kniu_sys_loading_spinner{animation:none}}'
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

    var DIRECTIVE_ATTRS = ['kniu:for', ':for', 'kniu:if', ':if', 'kniu:elseif', ':elseif', 'kniu:else', ':else'];
    var hasDirectiveAncestor = function (node) {
      var p = node.parentElement;
      while (p) {
        for (var i = 0; i < DIRECTIVE_ATTRS.length; i++) {
          if (p.hasAttribute(DIRECTIVE_ATTRS[i])) return true;
        }
        p = p.parentElement;
      }
      return false;
    };
    var queryDirectives = function (root, attrs) {
      return Array.prototype.filter.call(root.querySelectorAll('*'), function (n) {
        for (var i = 0; i < attrs.length; i++) {
          if (n.hasAttribute(attrs[i])) return true;
        }
        return false;
      });
    };

    const applyBindings = function (root, base, extra, bucket, refs) {
      const resolve = function (key) { return evalExpr(key, base, extra).value; };
      const subscribe = function (key, fn) {
        evalExpr(key, base, extra).paths.forEach(function (p) { return subscribePath(base, p, fn, bucket); });
      };
      const write = function (key, value) { return setPath(base, key, value); };
      const bindingNodeCache = new Map();
      const collectBindingNodes = function (container) {
        const cached = bindingNodeCache.get(container);
        if (cached) return cached;
        const elements = [...container.querySelectorAll('*')];
        const templateElements = [];
        for (let index = 0; index < elements.length; index += 1) {
          const element = elements[index];
          if (element.tagName !== 'TEMPLATE') continue;
          if (element.hasAttribute('kniu:for') || element.hasAttribute(':for')
            || element.hasAttribute('kniu:if') || element.hasAttribute(':if')
            || element.hasAttribute('kniu:elseif') || element.hasAttribute(':elseif')
            || element.hasAttribute('kniu:else') || element.hasAttribute(':else')) continue;
          const tableColumn = element.closest('kniu-table-col');
          [...element.content.querySelectorAll('*')].forEach(function (inner) {
            if (tableColumn) inner.__kniuTableColumn = tableColumn;
            templateElements.push(inner);
          });
        }
        const collected = [container, ...elements, ...templateElements];
        bindingNodeCache.set(container, collected);
        return collected;
      };

      const TEXT_RE = /\{\{\s*([\s\S]*?)\s*\}\}/g;
      const rawNodes = new WeakMap();
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let _tn;
      while ((_tn = walk.nextNode())) {
        const textNode = _tn;
        if (hasDirectiveAncestor(textNode)) continue;
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
            const onlyRawValue = segments.length === 1 && segments[0].t === 'key' && segments[0].raw;
            segments.forEach(function (s, index) {
              if (s.t === 'text') {
                built.push(document.createTextNode(s.v));
              } else if (!s.raw) {
                built.push(document.createTextNode(values[index]));
              } else {
                const holder = onlyRawValue ? document.createElement('template') : document.createElement('span');
                holder.innerHTML = sanitizeHtml(values[index]);
                if (onlyRawValue) {
                  built.push(...Array.from(holder.content.childNodes));
                } else {
                  built.push(holder);
                }
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
          if (node.hasAttribute('kniu:for') || node.hasAttribute(':for')
            || node.hasAttribute('kniu:if') || node.hasAttribute(':if')
            || node.hasAttribute('kniu:elseif') || node.hasAttribute(':elseif')
            || node.hasAttribute('kniu:else') || node.hasAttribute(':else')) {
            if (!node.__kniuTableColumn) return;
          }
          if (hasDirectiveAncestor(node)) return;

          const refAttr = node.hasAttribute('kniu:ref') ? 'kniu:ref' : (node.hasAttribute('ref') ? 'ref' : '');
          if (refAttr && refs) {
            const refName = node.getAttribute(refAttr);
            if (refName) refs[refName] = node;
            node.removeAttribute(refAttr);
          }

          if (node.hasAttribute('kniu:form') || node.hasAttribute(':form')) {
            const rawPath = stripBraces(node.getAttribute('kniu:form') || node.getAttribute(':form'));
            const isBool = node.type === 'checkbox' || node.type === 'radio';
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
            if (fieldObject) subscribe(rawPath, render);
            const onInput = function () { return write(path, isBool ? node.checked : node.value); };
            const evt = isBool ? 'change' : 'input';
            node.addEventListener(evt, onInput);
            listeners.push([node, evt, onInput]);
            if (node.hasAttribute('kniu:form')) node.removeAttribute('kniu:form');
            if (node.hasAttribute(':form')) node.removeAttribute(':form');
            if (fieldObject) node.__kniuModelPath = rawPath;
          }

          if (node.hasAttribute('kniu:option') || node.hasAttribute(':option')) {
            const expr = stripBraces(node.getAttribute('kniu:option') || node.getAttribute(':option'));
            const tag = node.tagName.toLowerCase();
            const componentCtor = tag.includes('-') && typeof customElements !== 'undefined'
              ? customElements.get(tag) : null;
            const isUnupgradedComponent = !!componentCtor && !(node instanceof componentCtor);
            const nativeOptionAttributes = new Set();
            const nativeOptionEvents = new Map();
            const renderOptions = function () {
              const value = resolve(expr);
              if (value && typeof value === 'object') {
                const componentDefaults = globalThis.__KNIU_UI_DEFAULTS__?.[tag] || {};
                const mergedValue = tag.includes('-') ? { ...componentDefaults, ...value } : value;
                const usesComponentOptions = tag.includes('-') && 'options' in node;
                if (usesComponentOptions) node.options = mergedValue;
                else if (isUnupgradedComponent) node.__kniuOptionsValue = mergedValue;
                const usesNativeOptionMapping = !usesComponentOptions && !isUnupgradedComponent;
                if (usesNativeOptionMapping) {
                  nativeOptionAttributes.forEach(function (name) { node.removeAttribute(name); });
                  nativeOptionAttributes.clear();
                }
                nativeOptionEvents.forEach(function (entry, eventName) {
                  node.removeEventListener(eventName, entry.handler, entry.options);
                });
                nativeOptionEvents.clear();
                Object.entries(mergedValue).forEach(function ([name, item]) {
                  const eventDescriptor = typeof item === 'function' ? optionEventDescriptor(name) : null;
                  if (eventDescriptor) {
                    const eventName = eventDescriptor.eventName;
                    const modifiers = eventDescriptor.modifiers;
                    const unknownModifiers = modifiers.filter(function (modifier) {
                      return !EVENT_OPTION_MODIFIERS.has(modifier) && !EVENT_BEHAVIOR_MODIFIERS.has(modifier);
                    });
                    if (unknownModifiers.length || (modifiers.includes('passive') && modifiers.includes('prevent'))) {
                      warn(`<${tag}> 的 kniu:option 事件 "${name}" 修饰符无效，已跳过绑定。`);
                      return;
                    }
                    const handler = function (event) {
                      if ((DEFAULT_PREVENT_EVENTS.has(eventName) || eventName === 'click')
                        && !modifiers.includes('native') && !modifiers.includes('passive') && !event.defaultPrevented) {
                        event.preventDefault();
                      }
                      const isKeyboardEvent = event.type.startsWith('key');
                      const keyModifiers = isKeyboardEvent
                        ? modifiers.filter(function (modifier) { return Object.prototype.hasOwnProperty.call(KEY_MODIFIER_VALUES, modifier); })
                        : [];
                      if (keyModifiers.length && !keyModifiers.some(function (modifier) { return KEY_MODIFIER_VALUES[modifier].includes(event.key); })) return;
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
                          event.ctrlKey !== requiredSystemKeys.has('ctrl') || event.shiftKey !== requiredSystemKeys.has('shift') ||
                          event.altKey !== requiredSystemKeys.has('alt') || event.metaKey !== requiredSystemKeys.has('meta')
                        )) return;
                        if (!isKeyboardEvent) {
                          if (modifier === 'left' && event.button !== 0) return;
                          if (modifier === 'middle' && event.button !== 1) return;
                          if (modifier === 'right' && event.button !== 2) return;
                        }
                        if (modifier === 'stop') event.stopPropagation();
                        if (modifier === 'prevent') event.preventDefault();
                      }
                      return item.call(base, event);
                    };
                    const listenerOptions = {
                      capture: modifiers.includes('capture'), once: modifiers.includes('once'), passive: modifiers.includes('passive')
                    };
                    node.addEventListener(eventName, handler, listenerOptions);
                    nativeOptionEvents.set(eventName, { handler: handler, options: listenerOptions });
                    listeners.push([node, eventName, handler, listenerOptions]);
                    return;
                  }
                  if (typeof item === 'function') {
                    if (usesNativeOptionMapping) warn(`<${tag}> 的 kniu:option 事件字段必须以 on 开头（如 onClick），已跳过 "${name}"。`);
                    return;
                  }
                  if (!usesNativeOptionMapping) return;
                  const attrName = isValidForTag(name, tag) ? name : optionAttributeName(name);
                  const bool = isBooleanAttr(attrName);
                  setAttr(node, attrName, item, bool);
                  if (item != null && item !== false) nativeOptionAttributes.add(attrName);
                });
              }
            };
            renderOptions();
            subscribe(expr, renderOptions);
            if (!node.__kniuTableColumn) {
              if (node.hasAttribute('kniu:option')) node.removeAttribute('kniu:option');
              if (node.hasAttribute(':option')) node.removeAttribute(':option');
            }
          }

          if (node.hasAttribute('kniu:rules') || node.hasAttribute(':rules')) {
            warn('kniu:rules 已作废，请改用 kniu:option，在字段上声明 value / condition / message。');
            node.removeAttribute('kniu:rules');
            node.removeAttribute(':rules');
          }

          if (node.hasAttribute('kniu:style') || node.hasAttribute(':style')) {
            const styleAttrName = node.hasAttribute('kniu:style') ? 'kniu:style' : ':style';
            const expr = stripBraces(node.getAttribute(styleAttrName));
            const managedProperties = new Set();
            const renderStyle = function () {
              const value = resolve(expr);
              managedProperties.forEach(function (name) { node.style.removeProperty(name); });
              managedProperties.clear();
              normalizeStyleValue(node, value).forEach(function ([name, item]) {
                if (!name || item == null || item === false) return;
                const cssValue = String(item).trim();
                if (!cssValue) return;
                node.style.setProperty(name, cssValue);
                managedProperties.add(name);
              });
              if (!node.getAttribute('style')) node.removeAttribute('style');
            };
            renderStyle();
            subscribe(expr, renderStyle);
            node.removeAttribute('kniu:style');
            node.removeAttribute(':style');
          }

          const loadingAttr = [...node.attributes].find(function (a) {
            return a.name === 'kniu:loading' || a.name === 'kniu:loading.body' ||
              a.name === ':loading' || a.name === ':loading.body';
          });
          if (loadingAttr) {
            const body = loadingAttr.name === 'kniu:loading.body' || loadingAttr.name === ':loading.body';
            const loadingExpr = stripBraces(loadingAttr.value);
            const hasText = node.hasAttribute('kniu:loading-text') || node.hasAttribute(':loading-text');
            const textExpr = hasText ? stripBraces(node.getAttribute(hasText ? 'kniu:loading-text' : ':loading-text')) : '';
            if (hasText) {
              node.removeAttribute(hasText ? 'kniu:loading-text' : ':loading-text');
            }
            node.removeAttribute('kniu:loading');
            node.removeAttribute('kniu:loading.body');
            node.removeAttribute(':loading');
            node.removeAttribute(':loading.body');
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
            } else {
              ensureLoadingStyle();
              const mask = document.createElement('div');
              mask.className = 'kniu_sys_loading_mask' + (body ? ' kniu_sys_loading_mask--body' : '');
              mask.setAttribute('data-active', 'false');
              const spinner = document.createElement('span');
              spinner.className = 'kniu_sys_loading_spinner';
              mask.appendChild(spinner);
              const textEl = document.createElement('span');
              textEl.className = 'kniu_sys_loading_text';
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
              listDisposers.push(unmount);
            }
          }

          const DATA_ATTR_RE = /^(?:kniu:|):\[([a-z][a-z0-9-]*)\]$/i;
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
              } else if (value == null || value === false || String(value).trim() === '') {
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
            if (!full.startsWith('kniu:') && !full.startsWith(':')) return;
            const key = full.startsWith('kniu:')
              ? (full.slice(5).startsWith(':') ? full.slice(6) : full.slice(5))
              : full.slice(1);
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

          const EVENT_RE = /^(?:kniu@|@)([a-z][a-z0-9-]*)(?:\.([a-z0-9.]+))?$/i;
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
            const isTableScopedRadioChange = insideTableColumn
              && node.matches('kniu-radio-group')
              && eventName === 'change';
            if (!isTableScopedSwitchChange && !isTableScopedButtonClick && !isTableScopedRadioChange && !isValidEventForTag(eventName, tag)) {
              warn(`kniu@${eventName} 不被 <${tag}> 支持，已跳过（事件只能绑定到元素原生支持的事件上）`);
              node.removeAttribute(attr.name);
              return;
            }
            const expr = attr.value.trim();
            const tableScopedControl = insideTableColumn && (
              (node.matches('kniu-btn') && eventName === 'click')
              || (node.matches('kniu-switch') && eventName === 'change')
              || (node.matches('kniu-radio-group') && eventName === 'change')
            );
            if (tableScopedControl) {
              const handlerMatch = expr.match(/^([A-Za-z_$][\w$]*)\s*\(/);
              const handlerName = handlerMatch?.[1] || expr;
              const columnEl = node.__kniuTableColumn || node.closest('kniu-table-col');
              const renderScopedHandler = function () {
                const { value } = evalExpr(handlerName, base, extra);
                const fn = typeof value === 'function' ? value.bind(base) : null;
                if (fn) {
                  node.__kniuTableScopedHandler = fn;
                  if (columnEl) columnEl.__kniuTableScopedSwitchHandler = fn;
                }
                if (node.matches('kniu-switch')) {
                  const disabledRaw = node.getAttribute('disabled');
                  if (disabledRaw && disabledRaw.includes('{{')) {
                    const { value: dv } = evalExpr(disabledRaw.replace(/^\{\{|\}\}$/g, '').trim(), base, extra);
                    if (dv) node.setAttribute('disabled', ''); else node.removeAttribute('disabled');
                  }
                }
              };
              renderScopedHandler();
              subscribe(handlerName, renderScopedHandler);
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
                if ((DEFAULT_PREVENT_EVENTS.has(eventName) || eventName === 'click')
                  && !modifiers.includes('native') && !modifiers.includes('passive')) {
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
          if (node.hasAttribute('kniu:for') || node.hasAttribute(':for')
            || node.hasAttribute('kniu:if') || node.hasAttribute(':if')
            || node.hasAttribute('kniu:elseif') || node.hasAttribute(':elseif')
            || node.hasAttribute('kniu:else') || node.hasAttribute(':else')) return;
          if (hasDirectiveAncestor(node)) return;
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
      const forAttr = block.getAttribute('kniu:for') || block.getAttribute(':for');
      const forMatch = forAttr.match(/\{\{([\s\S]*?)\}\}/);
      const arrayExpr = (forMatch ? forMatch[1] : forAttr).trim();
      const idxName = block.getAttribute('kniu:for-index') || block.getAttribute(':for-index') || 'index';
      const itemName = block.getAttribute('kniu:for-item') || block.getAttribute(':for-item') || 'item';
      const keyExpr = block.getAttribute('kniu:key') || block.getAttribute(':key');
      const useKeyed = !!keyExpr;
      const isTpl = block.tagName === 'TEMPLATE';
      const tpl = isTpl ? block.content : block.cloneNode(true);
      if (!isTpl) {
        tpl.removeAttribute('kniu:for');
        tpl.removeAttribute(':for');
        tpl.removeAttribute('kniu:for-index');
        tpl.removeAttribute(':for-index');
        tpl.removeAttribute('kniu:for-item');
        tpl.removeAttribute(':for-item');
        tpl.removeAttribute('kniu:key');
        tpl.removeAttribute(':key');
      }
      const anchor = document.createComment('kniu:for');
      block.replaceWith(anchor);
      let rendered = [];
      let prevViews = [];
      let subCleanups = [];
      // 订阅只注册到自身 subCleanups（每次 render 执行后清空，语义=「最近重渲染边界」）；
      // 最终 disposer 才上交 bucket——否则嵌套块每次父级重渲染都会向顶层 listDisposers 累积泄漏。
      const bc = subCleanups;

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
                queryDirectives(node, ['kniu:for', ':for']).forEach(function (n) { return setupFor(n, extra, nb); });
                queryDirectives(node, ['kniu:if', ':if']).forEach(function (n) { return setupIf(n, extra, nb); });
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
        if (!anchor.parentNode) return; // 所属分支已随父级 if 重渲染移除：过期渲染自 disarm，防对 null insertBefore 抛错
        subCleanups.forEach(function (c) { return c(); });
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
      (bucket || listDisposers).push(function () {
        subCleanups.forEach(function (c) { return c(); });
        subCleanups.length = 0;
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
          if (sib.hasAttribute('kniu:elseif') || sib.hasAttribute(':elseif')) {
            chain.push({ node: sib, type: 'elseif' });
            sib = sib.nextSibling;
            continue;
          }
          if (sib.hasAttribute('kniu:else') || sib.hasAttribute(':else')) {
            chain.push({ node: sib, type: 'else' });
            break;
          }
        }
        break;
      }

      const branches = chain.map(function ({ node, type }) {
        const tpl = node.cloneNode(true);
        if (type === 'if' || type === 'elseif') {
          const names = type === 'if' ? ['kniu:if', ':if'] : ['kniu:elseif', ':elseif'];
          const attrName = names.find(function (n) { return node.hasAttribute(n); }) || names[0];
          const raw = node.getAttribute(attrName) ?? '';
          const m = raw.match(/\{\{([\s\S]*?)\}\}/);
          const expr = (m ? m[1] : raw).trim();
          names.forEach(function (n) { tpl.removeAttribute(n); });
          return { type, expr, tpl, value: false };
        }
        ['kniu:else', ':else'].forEach(function (n) { tpl.removeAttribute(n); });
        return { type: 'else', expr: null, tpl, value: false };
      });

      const anchor = document.createComment('kniu:if');
      block.replaceWith(anchor);
      chain.slice(1).forEach(function ({ node }) { return node.remove(); });

      let rendered = [];
      const cleanups = [];
      // 订阅只注册到自身 cleanups（每次 render 执行后清空）；最终 disposer 才上交 bucket，
      // 防止嵌套块随父级分支切换向顶层 listDisposers 无限累积（内存泄漏 + 过期渲染崩溃）。
      const bc = cleanups;

      const render = function () {
        if (!anchor.parentNode) return; // 本分支已随父级重渲染移除：过期渲染自 disarm
        cleanups.forEach(function (c) { return c(); });
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
          const nodes = isTpl ? [...frag.childNodes] : [frag];
          nodes.forEach(function (node) {
            if (node.nodeType === 1) {
              queryDirectives(node, ['kniu:for', ':for']).forEach(function (n) { return setupFor(n, parentExtra, bc); });
              queryDirectives(node, ['kniu:if', ':if']).forEach(function (n) { return setupIf(n, parentExtra, bc); });
            }
            anchor.parentNode.insertBefore(node, anchor);
            applyBindings(node, state, parentExtra, bc, refs);
            rendered.push(node);
          });
        }
      };

      render();
      (bucket || listDisposers).push(function () {
        cleanups.forEach(function (c) { return c(); });
        cleanups.length = 0;
        rendered.forEach(function (n) { return n.remove(); });
      });
    };

    applyBindings(scope, state, {}, subscriptions, refs);

    [...queryDirectives(scope, ['kniu:for', ':for'])]
      .filter(function (b) { return !hasDirectiveAncestor(b); })
      .forEach(function (b) { return setupFor(b, {}); });

    let guard = 0;
    let ifBlock;
    while (
      (ifBlock = queryDirectives(scope, ['kniu:if', ':if'])[0]) &&
      !hasDirectiveAncestor(ifBlock) &&
      guard++ < 1000
    ) {
      setupIf(ifBlock, {});
    }

    const orphanDirectives = [
      'kniu:elseif', 'kniu:else', 'kniu:key', 'kniu:for-index', 'kniu:for-item',
      ':elseif', ':else', ':key', ':for-index', ':for-item',
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