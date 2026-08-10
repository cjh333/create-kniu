var KniuTemplate = (function () {
  const SUBS = Symbol('kniu-subs');
  const IS_REACTIVE = Symbol('kniu-is-reactive');
  const proxyCache = new WeakMap();
  const changeObservers = new WeakMap();
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

  const GLOBAL_ATTRS = new Set([
    'id', 'class', 'style', 'title', 'lang', 'dir', 'tabindex', 'hidden', 'role',
    'draggable', 'contenteditable', 'translate', 'spellcheck', 'accesskey',
    'autocapitalize', 'enterkeyhint', 'inputmode', 'slot', 'part', 'exportparts',
    'is', 'inert', 'popover',
  ]);

  const ATTR_TAGS = {
    href: ['a', 'area', 'base', 'link'],
    src: ['img', 'script', 'iframe', 'audio', 'video', 'source', 'track', 'embed', 'input'],
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
    'for', 'if', 'elseif', 'else',
    'for-index', 'for-item', 'key',
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
    input: ['input', 'textarea', 'select', 'button'],
    change: ['input', 'textarea', 'select', 'button'],
    submit: ['form'],
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
      if (value) node.setAttribute(name, '');
      else node.removeAttribute(name);
      return;
    }
    if (name === 'value') {
      if ('value' in node) node.value = value == null ? '' : value;
      else node.setAttribute('value', value == null ? '' : String(value));
      return;
    }
    if (value == null || value === false) {
      node.removeAttribute(name);
      return;
    }
    if (URL_ATTRS.has(name) && isDangerousUrl(String(value))) {
      warn(`kniu:${name} 的 URL 含危险协议（${value}），已拒绝写入以防 XSS`);
      node.removeAttribute(name);
      return;
    }
    node.setAttribute(name, String(value));
  }

  function warn(msg) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[kniutemplate] ' + msg);
  }

  function evalExpr(expr, base, extra) {
    const e = String(expr).trim();
    const forms = looksLikeObject(e)
      ? [`with(__s){ return ({${e}}); }`, `with(__s){ return (${e}); }`]
      : [`with(__s){ return (${e}); }`, `with(__s){ return ({${e}}); }`];
    let fn = null;
    for (const body of forms) {
      try {
        fn = new Function('__s', body);
        break;
      } catch {
        fn = null;
      }
    }
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

  function reactive(target) {
    if (!isObject(target)) return target;
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
        if (key === SUBS) return subscribers;
        if (key === IS_REACTIVE) return true;
        const val = obj[key];
        return isObject(val) ? reactive(val) : val;
      },
      set(obj, key, value) {
        const old = obj[key];
        obj[key] = value;
        if (old !== value) {
          const set = subscribers.get(key);
          if (set) set.forEach(function (fn) { return fn(value); });
          const observers = changeObservers.get(proxy);
          if (observers) observers.forEach(function (fn) { fn({ target: proxy, key, value, oldValue: old, type: 'set' }); });
        }
        return true;
      },
      deleteProperty(obj, key) {
        const had = Object.prototype.hasOwnProperty.call(obj, key);
        const old = obj[key];
        const ok = delete obj[key];
        if (had) {
          const set = subscribers.get(key);
          if (set) set.forEach(function (fn) { return fn(undefined); });
          const observers = changeObservers.get(proxy);
          if (observers) observers.forEach(function (fn) { fn({ target: proxy, key, value: undefined, oldValue: old, type: 'delete' }); });
        }
        return ok;
      },
    };

    const proxy = new Proxy(target, handler);
    proxyCache.set(target, proxy);

    if (currentScope && !binding) {
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

  function observe(target, listener) {
    if (!target || !target[IS_REACTIVE] || typeof listener !== 'function') return function () { };
    let observers = changeObservers.get(target);
    if (!observers) {
      observers = new Set();
      changeObservers.set(target, observers);
    }
    observers.add(listener);
    return function () { observers.delete(listener); };
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

  function bind(scope, source) {
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

    const applyBindings = function (root, base, extra, bucket) {
      const resolve = function (key) { return evalExpr(key, base, extra).value; };
      const subscribe = function (key, fn) {
        evalExpr(key, base, extra).paths.forEach(function (p) { return subscribePath(base, p, fn, bucket); });
      };
      const write = function (key, value) { return setPath(base, key, value); };

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
            return textNode.nodeValue = segments
              .map(function (s) { return s.t === 'text' ? s.v : String(resolve(s.k) ?? ''); })
              .join('');
          };
          render();
          segments.filter(function (s) { return s.t === 'key'; }).forEach(function (s) { return subscribe(s.k, render); });
        } else {
          const render = function () {
            const parent = textNode.parentNode;
            if (!parent) return;
            if (rawNodes.has(textNode)) {
              rawNodes.get(textNode).forEach(function (n) { return n.remove(); });
              rawNodes.delete(textNode);
            }
            const built = [];
            segments.forEach(function (s) {
              if (s.t === 'text') {
                built.push(document.createTextNode(s.v));
              } else if (!s.raw) {
                built.push(document.createTextNode(String(resolve(s.k) ?? '')));
              } else {
                const span = document.createElement('span');
                span.innerHTML = sanitizeHtml(String(resolve(s.k) ?? ''));
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
        const nodes = [root, ...root.querySelectorAll('*')];
        nodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.hasAttribute('kniu:for') || node.hasAttribute('kniu:if') || node.hasAttribute('kniu:elseif') || node.hasAttribute('kniu:else')) return;
          if (hasAncestor(node, '[kniu\\:for],[kniu\\:if],[kniu\\:elseif],[kniu\\:else]')) return;

          if (node.hasAttribute('kniu:model')) {
            const path = stripBraces(node.getAttribute('kniu:model'));
            const isBool = node.type === 'checkbox' || node.type === 'radio';
            const render = function () {
              const v = resolve(path);
              if (isBool) node.checked = Boolean(v);
              else node.value = v ?? '';
            };
            render();
            subscribe(path, render);
            const onInput = function () { return write(path, isBool ? node.checked : node.value); };
            const evt = isBool ? 'change' : 'input';
            node.addEventListener(evt, onInput);
            listeners.push([node, evt, onInput]);
            node.removeAttribute('kniu:model');
          }

          const DATA_ATTR_RE = /^kniu:\[([a-z][a-z0-9-]*)\]$/i;
          [...node.attributes].forEach(function (attr) {
            const match = attr.name.match(DATA_ATTR_RE);
            if (!match) return;
            const dataAttrName = `data-${match[1].toLowerCase()}`;
            const expr = stripBraces(attr.value);
            const render = function () {
              const { value } = evalExpr(expr, base, extra);
              if (value == null || value === false) node.removeAttribute(dataAttrName);
              else node.setAttribute(dataAttrName, String(value));
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

          const EVENT_RE = /^kniu@([a-z][a-z0-9]*)(?:\.([a-z0-9.]+))?$/i;
          const EVENT_OPTION_MODIFIERS = new Set(['capture', 'once', 'passive']);
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
            if (!isValidEventForTag(eventName, tag)) {
              warn(`kniu@${eventName} 不被 <${tag}> 支持，已跳过（事件只能绑定到元素原生支持的事件上）`);
              node.removeAttribute(attr.name);
              return;
            }
            const expr = attr.value.trim();
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
        const nodes = [root, ...root.querySelectorAll('*')];
        nodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.hasAttribute('kniu:for') || node.hasAttribute('kniu:if') || node.hasAttribute('kniu:elseif') || node.hasAttribute('kniu:else')) return;
          if (hasAncestor(node, '[kniu\\:for],[kniu\\:if],[kniu\\:elseif],[kniu\\:else]')) return;
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
            const render = function () {
              const parts = segments.map(function (s) { return s.t === 'text' ? s.v : resolve(s.k); });
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
                node.setAttribute(name, resolved);
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
              applyBindings(node, state, extra, nb);
            });
            initialized = true;
          } else {
            roots.forEach(function (node) { return applyBindings(node, state, extra, nb); });
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
            applyBindings(node, state, parentExtra, bc);
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

    applyBindings(scope, state, {}, subscriptions);

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
    return { state, dispose };
  }

  return {
    reactive: reactive,
    observe: observe,
    beginBindingCollection: beginBindingCollection,
    endBindingCollection: endBindingCollection,
    bind: bind
  };
}());

export const reactive = KniuTemplate.reactive;
export const observe = KniuTemplate.observe;
export const beginBindingCollection = KniuTemplate.beginBindingCollection;
export const endBindingCollection = KniuTemplate.endBindingCollection;
export const bind = KniuTemplate.bind;
