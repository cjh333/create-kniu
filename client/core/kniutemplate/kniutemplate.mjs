import { nextTick, queueJob } from '../kniuscheduler.mjs';
import { isDangerousUrl, isDangerousSrcset } from '../kniusanitizer.mjs';

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

  function upgradeCustomElements(root) {
    if (!root || typeof customElements === 'undefined' || typeof customElements.upgrade !== 'function') return;
    const getNames = customElements.getNames;
    if (typeof getNames === 'function') {
      const definedNames = getNames.call(customElements);
      if (!definedNames.length) return;
      const selector = definedNames.join(',');
      const hit = (typeof root.matches === 'function' && root.matches(selector))
        || (typeof root.querySelector === 'function' && root.querySelector(selector) !== null);
      if (!hit) return;
    }
    if (root.ownerDocument && root.ownerDocument !== document) document.adoptNode(root);
    customElements.upgrade(root);
  }

  const FOR_ATTRS = ['kniu:for', ':for'];
  const IF_ATTRS = ['kniu:if', ':if'];
  const DIRECTIVE_ATTRS = FOR_ATTRS.concat(IF_ATTRS, ['kniu:elseif', ':elseif', 'kniu:else', ':else']);
  const EVENT_ATTR_RE = /^(?:kniu@|@)[a-z][a-z0-9-]*(?:\.[a-z0-9.]+)?$/i;

  function hasEventAttributes(root) {
    if (!root) return false;
    const elements = selfAndDescendants(root);
    for (let i = 0; i < elements.length; i++) {
      const attrs = elements[i].attributes;
      if (!attrs) continue;
      for (let j = 0; j < attrs.length; j++) {
        if (EVENT_ATTR_RE.test(attrs[j].name)) return true;
      }
    }
    if (typeof root.querySelectorAll === 'function') {
      const templates = root.querySelectorAll('template');
      for (let k = 0; k < templates.length; k++) {
        if (hasEventAttributes(templates[k].content)) return true;
      }
    }
    return false;
  }
  function hasDirectiveAncestor(node) {
    let p = node.parentElement;
    while (p) {
      for (let i = 0; i < DIRECTIVE_ATTRS.length; i++) {
        if (p.hasAttribute(DIRECTIVE_ATTRS[i])) return true;
      }
      p = p.parentElement;
    }
    return false;
  }
  function queryDirectives(root, attrs) {
    const matches = function (n) {
      for (let i = 0; i < attrs.length; i++) {
        if (n.hasAttribute(attrs[i])) return true;
      }
      return false;
    };
    const result = [];
    if (root && root.nodeType === 1 && matches(root)) result.push(root);
    return result.concat(Array.prototype.filter.call(root.querySelectorAll('*'), matches));
  }

  function hasAnyDirective(node) {
    for (let i = 0; i < DIRECTIVE_ATTRS.length; i++) {
      if (node.hasAttribute(DIRECTIVE_ATTRS[i])) return true;
    }
    return false;
  }

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
          if (DANGEROUS_SCOPE_KEYS.has(key)) return undefined;
          if (prefix === '' && extra && key in extra) {
            accessed.push(key);
            const ev = extra[key];
            if (ev !== null && typeof ev === 'object'
              && !(ev instanceof Date) && !(ev instanceof Node) && !Array.isArray(ev)) {
              return wrap(ev, key);
            }
            return ev;
          }
          const full = prefix ? prefix + '.' + key : key;
          accessed.push(full);
          const v = obj[key];
          if (v === undefined) {
            return undefined;
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

  function extractBracedExpr(raw) {
    const m = String(raw).match(/\{\{([\s\S]*?)\}\}/);
    return (m ? m[1] : String(raw)).trim();
  }

  function parseBindingSegments(text, trackRaw) {
    const segments = [];
    const source = String(text == null ? '' : text);
    let last = 0;
    let m;
    const re = /\{\{\s*([\s\S]*?)\s*\}\}/g;
    while ((m = re.exec(source))) {
      if (m.index > last) segments.push({ t: 'text', v: source.slice(last, m.index) });
      const raw = m[1].trim();
      const unescape = raw.startsWith('@');
      const segment = { t: 'key', k: unescape ? raw.slice(1).trim() : raw };
      if (trackRaw) segment.raw = unescape;
      segments.push(segment);
      last = m.index + m[0].length;
    }
    if (last < source.length) segments.push({ t: 'text', v: source.slice(last) });
    return segments;
  }

  function toCamelCase(name) {
    return String(name).replace(/-([a-z0-9])/g, function (_, char) { return char.toUpperCase(); });
  }

  function runCleanups(list) {
    list.forEach(function (c) { return c(); });
    list.length = 0;
  }

  function materializeRoots(tpl) {
    const isTemplateEl = tpl.nodeType === 1 && tpl.tagName === 'TEMPLATE';
    const frag = isTemplateEl ? tpl.content.cloneNode(true) : tpl.cloneNode(true);
    upgradeCustomElements(frag);
    return frag.nodeType === 11 ? [...frag.childNodes] : [frag];
  }

  function directiveAttr(node, name) {
    return node.getAttribute('kniu:' + name) || node.getAttribute(':' + name) || null;
  }
  function hasDirectiveAttr(node, name) {
    return node.hasAttribute('kniu:' + name) || node.hasAttribute(':' + name);
  }
  function removeDirectiveAttrs(node, name) {
    node.removeAttribute('kniu:' + name);
    node.removeAttribute(':' + name);
  }

  function selfAndDescendants(root) {
    if (!root) return [];
    if (typeof root.querySelectorAll !== 'function') return [root];
    return [root, ...root.querySelectorAll('*')];
  }

  function collectSinceBaseline(anchorNode, baseline) {
    const collected = [];
    let sib = anchorNode.previousSibling;
    while (sib && sib !== baseline) {
      collected.unshift(sib);
      sib = sib.previousSibling;
    }
    collected.push(anchorNode);
    return collected;
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

  const LOADING_ATTR_NAMES = ['kniu:loading', ':loading', 'kniu:loading.body', ':loading.body'];
  const LOADING_BODY_ATTR_NAMES = ['kniu:loading.body', ':loading.body'];
  const LOADING_TEXT_ATTR_NAMES = ['kniu:loading-text', ':loading-text'];

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

  function applyEventModifiers(event, eventName, modifiers) {
    if ((DEFAULT_PREVENT_EVENTS.has(eventName) || eventName === 'click')
      && !modifiers.includes('native') && !modifiers.includes('passive') && !event.defaultPrevented) {
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
      if (!matched) return false;
    }
    const requiredSystemKeys = new Set(modifiers.filter(function (modifier) {
      return ['ctrl', 'shift', 'alt', 'meta'].includes(modifier);
    }));
    for (const modifier of modifiers) {
      if (EVENT_OPTION_MODIFIERS.has(modifier) || keyModifiers.includes(modifier)) continue;
      if (modifier === 'self' && event.target !== event.currentTarget) return false;
      if (modifier === 'ctrl' && !event.ctrlKey) return false;
      if (modifier === 'shift' && !event.shiftKey) return false;
      if (modifier === 'alt' && !event.altKey) return false;
      if (modifier === 'meta' && !event.metaKey) return false;
      if (modifier === 'exact' && (
        event.ctrlKey !== requiredSystemKeys.has('ctrl') || event.shiftKey !== requiredSystemKeys.has('shift') ||
        event.altKey !== requiredSystemKeys.has('alt') || event.metaKey !== requiredSystemKeys.has('meta')
      )) return false;
      if (!isKeyboardEvent) {
        if (modifier === 'left' && event.button !== 0) return false;
        if (modifier === 'middle' && event.button !== 1) return false;
        if (modifier === 'right' && event.button !== 2) return false;
      }
      if (modifier === 'stop') event.stopPropagation();
      if (modifier === 'prevent') event.preventDefault();
    }
    return true;
  }

  function modifierListenerOptions(modifiers) {
    return {
      capture: modifiers.includes('capture'),
      once: modifiers.includes('once'),
      passive: modifiers.includes('passive')
    };
  }

  function findUnknownModifiers(modifiers) {
    return modifiers.filter(function (modifier) {
      return !EVENT_OPTION_MODIFIERS.has(modifier) && !EVENT_BEHAVIOR_MODIFIERS.has(modifier);
    });
  }
  function hasConflictingModifiers(modifiers) {
    return modifiers.includes('passive') && modifiers.includes('prevent');
  }

  function isValidEventForTag(event, tag) {
    const allowed = EVENT_TAGS[event];
    if (!allowed) return true;
    if (allowed === '*') return true;
    return allowed.includes((tag || '').toLowerCase());
  }

  const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'poster', 'srcset']);
  const URL_PROXY_PREFIX = 'data-kniu-url-';

  function neutralizeTemplateUrls(root) {
    if (!root || (root.nodeType !== 1 && root.nodeType !== 11)) return root;
    const nodes = selfAndDescendants(root);
    nodes.forEach(function (node) {
      if (node.nodeType !== 1) return;
      [...node.attributes].forEach(function (attr) {
        if (!URL_ATTRS.has(attr.name)) return;
        if (!attr.value || !attr.value.includes('{{')) return;
        node.setAttribute(URL_PROXY_PREFIX + attr.name, attr.value);
        node.removeAttribute(attr.name);
      });
      if (node.tagName === 'TEMPLATE' && node.content) neutralizeTemplateUrls(node.content);
    });
    return root;
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
        } else if (URL_ATTRS.has(n) && (isDangerousUrl(a.value) || (n === 'srcset' && isDangerousSrcset(a.value)))) {
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

  function cacheSetLimited(cache, key, value, limit) {
    if (cache.size >= limit) cache.delete(cache.keys().next().value);
    cache.set(key, value);
  }

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
        cacheSetLimited(SANITIZE_CACHE, key, result, SANITIZE_CACHE_LIMIT);
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
    if (URL_ATTRS.has(name) && (isDangerousUrl(String(value)) || (name === 'srcset' && isDangerousSrcset(value)))) {
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

  function isSafeStyleValue(value) {
    const raw = String(value || '').trim();
    if (/expression\s*\(/i.test(raw)) return false;
    const urls = raw.match(/url\(\s*(['"]?)(.*?)\1\s*\)/gi) || [];
    return urls.every(function (token) {
      const url = token.replace(/^url\(\s*['"]?|['"]?\s*\)$/gi, '');
      return !isDangerousUrl(url);
    });
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
      cacheSetLimited(expressionCache, e, fn, EXPRESSION_CACHE_LIMIT);
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
    } catch (err) {
      value = '';
      if (globalThis.__KNIU_DEV__) warn('表达式求值失败 [' + e.slice(0, 120) + ']：' + (err && err.message ? err.message : 'unknown'));
    }
    return { value, paths: accessed };
  }

  function precompileTemplate(root) {
    if (!root || typeof document === 'undefined') return 0;
    const expressions = new Set();
    const collectText = function (value) {
      parseBindingSegments(value).forEach(function (segment) {
        if (segment.t === 'key') expressions.add(segment.k);
      });
    };
    const nodes = selfAndDescendants(root);
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
        const isArrayIndexAdd = !had && Array.isArray(obj) && key !== 'length';
        const isArrayIndexSet = !isArrayIndexAdd && Array.isArray(obj)
          && key !== 'length' && /^\d+$/.test(key);
        obj[key] = value;
        if (!Object.is(old, value) || isArrayIndexAdd) {
          const set = subscribers.get(key);
          if (set) [...set].forEach(function (fn) { queueJob(fn); });
          const observers = changeObservers.get(proxy);
          const keyed = observers && observers.get(key);
          if (keyed) [...keyed].forEach(function (fn) { queueJob(fn); });
          const iterators = !had && observers && observers.get(ITERATE);
          if (iterators) [...iterators].forEach(function (fn) { queueJob(fn); });
          if (isArrayIndexAdd || isArrayIndexSet) {
            const lengthSubs = subscribers.get('length');
            if (lengthSubs) [...lengthSubs].forEach(function (fn) { queueJob(fn); });
          }
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

  function isTraversalStep(expr, path, extra) {
    if (!extra || path.includes('.')) return false;
    if (!Object.prototype.hasOwnProperty.call(extra, path)) return false;
    const text = String(expr);
    return text.includes(path + '.') || text.includes(path + '[');
  }

  function subscribeIterate(target, fn, cleanups) {
    if (!target || typeof target !== 'object') return;
    let observers = changeObservers.get(target);
    if (!observers) {
      observers = new Map();
      changeObservers.set(target, observers);
    }
    let iterateSet = observers.get(ITERATE);
    if (!iterateSet) {
      iterateSet = new Set();
      observers.set(ITERATE, iterateSet);
    }
    iterateSet.add(fn);
    cleanups.push(function () {
      const current = changeObservers.get(target);
      const set = current && current.get(ITERATE);
      if (set) set.delete(fn);
    });
  }

  function subscribeWholeObject(target, fn, cleanups) {
    if (!target || typeof target !== 'object' || !target[SUBS]) return;
    const subs = target[SUBS];
    const keys = Array.isArray(target) ? ['length'] : Object.keys(target);
    keys.forEach(function (key) {
      if (!subs.has(key)) subs.set(key, new Set());
      const set = subs.get(key);
      set.add(fn);
      cleanups.push(function () {
        const current = subs.get(key);
        if (current) current.delete(fn);
      });
    });
    subscribeIterate(target, fn, cleanups);
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

  function bind(scope, source, refs) {
    precompileTemplate(scope);
    neutralizeTemplateUrls(scope);
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

    const subscribePath = function (target, path, fn, cleanups = subscriptions, extra = null) {
      const parts = String(path).split('.');
      if (extra && Object.prototype.hasOwnProperty.call(extra, parts[0])) {
        if (parts.length === 1) {
          subscribeWholeObject(extra[parts[0]], fn, cleanups);
          return;
        }
        let scoped = extra[parts[0]];
        for (let i = 1; i < parts.length; i++) {
          if (scoped == null) break;
          const subs = scoped[SUBS];
          if (subs) {
            if (!subs.has(parts[i])) subs.set(parts[i], new Set());
            const set = subs.get(parts[i]);
            set.add(fn);
            cleanups.push(function () { return set.delete(fn); });
          }
          if (i < parts.length - 1) scoped = scoped[parts[i]];
        }
        return;
      }
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

    const applyBindings = function (root, base, extra, bucket, refs) {
      const exprPathCache = new Map();
      const resolve = function (key) {
        const result = evalExpr(key, base, extra);
        exprPathCache.set(key, result.paths);
        return result.value;
      };
      const subscribe = function (key, fn) {
        let paths = exprPathCache.get(key);
        if (!paths) {
          paths = evalExpr(key, base, extra).paths;
          exprPathCache.set(key, paths);
        }
        paths.forEach(function (p) {
          if (isTraversalStep(key, p, extra)) return;
          subscribePath(base, p, fn, bucket, extra);
        });
      };
      const bindRender = function (expr, fn) {
        fn();
        subscribe(expr, fn);
      };
      const write = function (key, value) {
        const parts = String(key).split('.');
        if (parts.length > 1) {
          const parent = evalExpr(parts.slice(0, -1).join('.'), base, extra).value;
          if (parent != null && typeof parent === 'object') {
            parent[parts[parts.length - 1]] = value;
            return;
          }
        }
        setPath(base, key, value);
      };
      let collectedBindingNodes = null;
      const collectBindingNodes = function (container) {
        if (collectedBindingNodes && collectedBindingNodes.container === container) return collectedBindingNodes.nodes;
        const elements = selfAndDescendants(container);
        const templateElements = [];
        for (let index = 0; index < elements.length; index += 1) {
          const element = elements[index];
          if (element.tagName !== 'TEMPLATE') continue;
          if (hasAnyDirective(element)) continue;
          if (element.hasAttribute('#append') || element.hasAttribute('#prepend')) continue;
          const tableColumn = element.closest('kniu-table-col');
          [...element.content.querySelectorAll('*')].forEach(function (inner) {
            if (tableColumn) inner.__kniuTableColumn = tableColumn;
            templateElements.push(inner);
          });
        }
        const collected = [...elements, ...templateElements];
        collectedBindingNodes = { container: container, nodes: collected };
        return collected;
      };

      const rawNodes = new WeakMap();
      const bindTextNode = function (textNode) {
        if (hasDirectiveAncestor(textNode)) return;
        const text = textNode.nodeValue;
        if (!text.includes('{{')) return;
        const segments = parseBindingSegments(text, true);
        const hasRaw = segments.some(function (s) { return s.t === 'key' && s.raw; });
        let previousRaw = null;
        const render = hasRaw
          ? function () {
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
          }
          : function () {
            const next = segments
              .map(function (s) { return s.t === 'text' ? s.v : String(resolve(s.k) ?? ''); })
              .join('');
            if (textNode.nodeValue !== next) textNode.nodeValue = next;
            return next;
          };
        render();
        segments.filter(function (s) { return s.t === 'key'; }).forEach(function (s) { return subscribe(s.k, render); });
      };
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let _tn;
      while ((_tn = walk.nextNode())) bindTextNode(_tn);
      if (typeof root.querySelectorAll === 'function') {
        Array.prototype.forEach.call(root.querySelectorAll('template'), function (tpl) {
          if (hasAnyDirective(tpl)) return;
          if (tpl.hasAttribute('#append') || tpl.hasAttribute('#prepend')) return;
          const innerWalker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
          let innerNode;
          while ((innerNode = innerWalker.nextNode())) bindTextNode(innerNode);
        });
      }

      if (root.nodeType === 1 || root.nodeType === 11) {
        var scheduleAffixRebind = function (template) {
          var parent = template.parentNode;
          if (!parent || typeof MutationObserver === 'undefined') return;
          var slotName = template.hasAttribute('#append') ? 'append' : 'prepend';
          var observer = new MutationObserver(function (records) {
            var replaced = records.some(function (record) {
              return Array.prototype.some.call(record.removedNodes, function (removed) { return removed === template; });
            });
            if (!replaced) return;
            observer.disconnect();
            clearTimeout(timer);
            var span = parent.querySelector('[slot="' + slotName + '"]');
            if (!span) return;
            var walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
            var textNode;
            while ((textNode = walker.nextNode())) bindTextNode(textNode);
            Array.prototype.forEach.call(span.querySelectorAll('*'), applyElementBindings);
          });
          var timer = setTimeout(function () { observer.disconnect(); }, 500);
          observer.observe(parent, { childList: true });
        };

        var applyElementBindings = function (node) {
          if (hasAnyDirective(node) && !node.__kniuTableColumn) return;
          if (hasDirectiveAncestor(node)) return;

          const refAttr = node.hasAttribute('kniu:ref') ? 'kniu:ref' : (node.hasAttribute('ref') ? 'ref' : '');
          if (refAttr && refs) {
            const refName = node.getAttribute(refAttr);
            if (refName) refs[refName] = node;
            node.removeAttribute(refAttr);
          }

          if (hasDirectiveAttr(node, 'option')) {
            const expr = stripBraces(directiveAttr(node, 'option'));
            const tag = node.tagName.toLowerCase();
            const nativeOptionEvents = new Map();
            const renderOptions = function () {
              const value = resolve(expr);
              if (value && typeof value === 'object') {
                const componentDefaults = globalThis.__KNIU_UI_DEFAULTS__?.[tag] || {};
                const mergedValue = tag.includes('-') ? { ...componentDefaults, ...value } : value;
                const usesComponentOptions = tag.includes('-') && 'options' in node;
                if (usesComponentOptions) node.options = mergedValue;
                else node.__kniuOptionsValue = mergedValue;
                nativeOptionEvents.forEach(function (entry, eventName) {
                  node.removeEventListener(eventName, entry.handler, entry.options);
                });
                nativeOptionEvents.clear();
                Object.entries(mergedValue).forEach(function ([name, item]) {
                  const eventDescriptor = typeof item === 'function' ? optionEventDescriptor(name) : null;
                  if (eventDescriptor) {
                    const eventName = eventDescriptor.eventName;
                    const modifiers = eventDescriptor.modifiers;
                    if (findUnknownModifiers(modifiers).length || hasConflictingModifiers(modifiers)) {
                      warn(`<${tag}> 的 kniu:option 事件 "${name}" 修饰符无效，已跳过绑定。`);
                      return;
                    }
                    const handler = function (event) {
                      if (!applyEventModifiers(event, eventName, modifiers)) return;
                      return item.call(base, event);
                    };
                    const listenerOptions = modifierListenerOptions(modifiers);
                    node.addEventListener(eventName, handler, listenerOptions);
                    nativeOptionEvents.set(eventName, { handler: handler, options: listenerOptions });
                    listeners.push([node, eventName, handler, listenerOptions]);
                    return;
                  }
                  if (typeof item === 'function' && !usesComponentOptions) {
                    warn(`<${tag}> 的 kniu:option 函数字段必须以 on 开头（如 onClick），已跳过 "${name}"。`);
                  }
                });
              }
            };
            bindRender(expr, renderOptions);
            if (!node.__kniuTableColumn) removeDirectiveAttrs(node, 'option');
          }

          if (hasDirectiveAttr(node, 'form')) {
            const rawPath = stripBraces(directiveAttr(node, 'form'));
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
            bindRender(path, render);
            if (fieldObject) subscribe(rawPath, render);
            const onInput = function () { return write(path, isBool ? node.checked : node.value); };
            const evt = isBool ? 'change' : 'input';
            node.addEventListener(evt, onInput);
            listeners.push([node, evt, onInput]);
            removeDirectiveAttrs(node, 'form');
            if (fieldObject) node.__kniuModelPath = rawPath;
          }

          if (hasDirectiveAttr(node, 'rules')) {
            warn('kniu:rules 已作废，请改用 kniu:option，在字段上声明 value / condition / message。');
            removeDirectiveAttrs(node, 'rules');
          }

          if (hasDirectiveAttr(node, 'style')) {
            const expr = stripBraces(directiveAttr(node, 'style'));
            const managedProperties = new Set();
            const renderStyle = function () {
              const value = resolve(expr);
              managedProperties.forEach(function (name) { node.style.removeProperty(name); });
              managedProperties.clear();
              normalizeStyleValue(node, value).forEach(function ([name, item]) {
                if (!name || item == null || item === false) return;
                const cssValue = String(item).trim();
                if (!cssValue || !isSafeStyleValue(cssValue)) return;
                node.style.setProperty(name, cssValue);
                managedProperties.add(name);
              });
              if (!node.getAttribute('style')) node.removeAttribute('style');
            };
            bindRender(expr, renderStyle);
            removeDirectiveAttrs(node, 'style');
          }

          const loadingAttr = [...node.attributes].find(function (a) {
            return LOADING_ATTR_NAMES.indexOf(a.name) !== -1;
          });
          if (loadingAttr) {
            const body = LOADING_BODY_ATTR_NAMES.indexOf(loadingAttr.name) !== -1;
            const loadingExpr = stripBraces(loadingAttr.value);
            const textAttrName = LOADING_TEXT_ATTR_NAMES.find(function (n) { return node.hasAttribute(n); }) || '';
            const textExpr = textAttrName ? stripBraces(node.getAttribute(textAttrName)) : '';
            LOADING_ATTR_NAMES.concat(LOADING_TEXT_ATTR_NAMES).forEach(function (n) { node.removeAttribute(n); });
            const delegate = !body && node.shadowRoot
              && typeof node.tagName === 'string'
              && node.tagName.toLowerCase().indexOf('kniu-') === 0
              && 'loading' in node;

            if (delegate) {
              const render = function () {
                node.loading = Boolean(resolve(loadingExpr));
                if (textExpr) node.loadingText = resolve(textExpr);
              };
              bindRender(loadingExpr, render);
              if (textExpr) subscribe(textExpr, render);
            } else {
              const mask = document.createElement('kniu-loading');
              if (!body) mask.setAttribute('contained', '');

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
                if (active) mount();
                mask.show = active;
                if (textExpr) {
                  mask.text = resolve(textExpr);
                }
              };
              bindRender(loadingExpr, render);
              if (textExpr) subscribe(textExpr, render);
              listDisposers.push(unmount);
            }
          }

          const DATA_ATTR_RE = /^(?:kniu:|:)\[([a-z][a-z0-9-]*)\]$/i;
          [...node.attributes].forEach(function (attr) {
            const match = attr.name.match(DATA_ATTR_RE);
            if (!match) return;
            const bindingName = match[1].toLowerCase();
            const dataAttrName = `data-${bindingName}`;
            const propertyName = toCamelCase(bindingName);
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
            bindRender(expr, render);
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
            bindRender(expr, render);
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
            const unknownModifiers = findUnknownModifiers(modifiers);
            if (unknownModifiers.length) {
              warn(`kniu@${eventName} 包含不支持的修饰符：${unknownModifiers.join(', ')}`);
              node.removeAttribute(attr.name);
              return;
            }
            if (hasConflictingModifiers(modifiers)) {
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
                    const { value: dv } = evalExpr(extractBracedExpr(disabledRaw), base, extra);
                    if (dv) node.setAttribute('disabled', ''); else node.removeAttribute('disabled');
                  }
                }
              };
              bindRender(handlerName, renderScopedHandler);
              return;
            }
            const handlers = eventState.get(node) || new Map();
            eventState.set(node, handlers);
            const bindingKey = attr.name.toLowerCase();
            const listenerOptions = modifierListenerOptions(modifiers);
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
                if (!applyEventModifiers(event, eventName, modifiers)) return;
                return value.call(base, event);
              };
              node.addEventListener(eventName, handler, listenerOptions);
              listeners.push([node, eventName, handler, listenerOptions]);
              handlers.set(bindingKey, { handler: handler, options: listenerOptions });
            };
            bindRender(expr, render);
            node.removeAttribute(attr.name);
          });

          if (node.tagName === 'TEMPLATE' && (node.hasAttribute('#append') || node.hasAttribute('#prepend'))) {
            scheduleAffixRebind(node);
          }
        };
        const nodes = (collectedBindingNodes && collectedBindingNodes.container === root)
          ? collectedBindingNodes.nodes
          : collectBindingNodes(root);
        nodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          applyElementBindings(node);
        });
        nodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (hasAnyDirective(node)) return;
          if (hasDirectiveAncestor(node)) return;
          if (node.__kniuTableColumn) return;
          [...node.attributes].forEach(function (attr) {
            const name = attr.name;
            if (name.startsWith('kniu:') || name.startsWith('kniu@')) return;
            const template = attr.value;
            if (!template.includes('{{')) return;
            const urlProxyTarget = name.startsWith(URL_PROXY_PREFIX) && URL_ATTRS.has(name.slice(URL_PROXY_PREFIX.length))
              ? name.slice(URL_PROXY_PREFIX.length)
              : null;
            const targetName = urlProxyTarget || name;
            const segments = parseBindingSegments(template);
            const isBool = isBooleanAttr(targetName);
            const pureExpr = segments.length === 1 && segments[0].t === 'key';
            const propertyName = toCamelCase(targetName);
            const bindsComponentProperty = node.tagName.includes('-') && propertyName in node;
            const render = function () {
              const parts = segments.map(function (s) { return s.t === 'text' ? s.v : resolve(s.k); });
              if (bindsComponentProperty && pureExpr) {
                const value = resolve(segments[0].k);
                if (!Object.is(node[propertyName], value)) node[propertyName] = value;
                return;
              }
              if (isBool && pureExpr) {
                if (parts[0]) node.setAttribute(targetName, '');
                else node.removeAttribute(targetName);
                return;
              }
              if (pureExpr && (parts[0] == null || parts[0] === false)) {
                node.removeAttribute(targetName);
                return;
              }
              const resolved = parts.map(function (v) { return v == null ? '' : String(v); }).join('');
              if (resolved === '' && !segments.some(function (s) { return s.t === 'text'; })) {
                node.removeAttribute(targetName);
              } else if (URL_ATTRS.has(targetName) && isDangerousUrl(resolved)) {
                warn(`属性 "${targetName}" 的插值 URL 含危险协议，已拒绝写入以防 XSS`);
                node.removeAttribute(targetName);
              } else {
                if (node.getAttribute(targetName) !== resolved) node.setAttribute(targetName, resolved);
              }
            };
            if (urlProxyTarget) node.removeAttribute(name);
            render();
            segments.filter(function (s) { return s.t === 'key'; }).forEach(function (s) { return subscribe(s.k, render); });
          });
        });
      }
    }

    const gatherBindingNodes = function (roots) {
      const out = [];
      const walk = function (node) {
        if (node.nodeType === 3) {
          if (node.nodeValue && node.nodeValue.includes('{{')) out.push(node);
          return;
        }
        if (node.nodeType !== 1) return;
        if (hasAnyDirective(node)) return;
        let hasBinding = false;
        Array.prototype.forEach.call(node.attributes, function (attr) {
          const name = attr.name;
          if (name.startsWith('kniu:') || name.startsWith('kniu@')) return;
          if (attr.value.includes('{{')) hasBinding = true;
        });
        if (hasBinding) out.push(node);
        Array.prototype.forEach.call(node.childNodes, walk);
      };
      roots.forEach(walk);
      return out;
    };

    const SIMPLE_PATH_RE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;
    const compileFastPath = function (expr) {
      const e = String(expr).trim();
      if (!SIMPLE_PATH_RE.test(e)) return null;
      const parts = e.split('.');
      if (DANGEROUS_SCOPE_KEYS.has(parts[0])) return null;
      const fastPaths = [];
      let acc = '';
      for (let i = 0; i < parts.length; i++) {
        acc = acc ? acc + '.' + parts[i] : parts[i];
        fastPaths.push(acc);
      }
      const get = function (base, extra) {
        let obj = (extra && Object.prototype.hasOwnProperty.call(extra, parts[0]))
          ? extra[parts[0]] : base[parts[0]];
        for (let i = 1; i < parts.length; i++) {
          if (obj == null) return undefined;
          obj = obj[parts[i]];
        }
        return obj;
      };
      return { get: get, fastPaths: fastPaths };
    };
    const resolveSegmentValue = function (s, base, extra) {
      const v = s.fast ? s.fast.get(base, extra) : evalExpr(s.k, base, extra).value;
      return v == null ? '' : String(v);
    };

    const compileLeafPlan = function (roots) {
      let unsupported = false;
      const plan = [];
      gatherBindingNodes(roots).forEach(function (node) {
        if (node.nodeType === 3) {
          const segments = parseBindingSegments(node.nodeValue);
          if (!segments.some(function (s) { return s.t === 'key'; })) return;
          plan.push({ type: 'text', node: node, segments: segments });
        } else {
          Array.prototype.forEach.call(node.attributes, function (attr) {
            const name = attr.name;
            if (name.startsWith('kniu:') || name.startsWith('kniu@')) return;
            if (name.startsWith(':')) { unsupported = true; return; }
            const tpl = attr.value;
            if (!tpl.includes('{{')) return;
            const segments = parseBindingSegments(tpl);
            if (!segments.some(function (s) { return s.t === 'key'; })) return;
            if (isBooleanAttr(name) || URL_ATTRS.has(name)) { unsupported = true; return; }
            if (name.startsWith(URL_PROXY_PREFIX)) { unsupported = true; return; }
            const propertyName = toCamelCase(name);
            if (node.tagName.includes('-') && propertyName in node) { unsupported = true; return; }
            plan.push({ type: 'attr', node: node, name: name, segments: segments });
          });
        }
      });
      if (unsupported) return null;
      plan.forEach(function (d) {
        d.segments.forEach(function (s) {
          if (s.t === 'key') s.fast = compileFastPath(s.k);
        });
        if (d.type === 'text') {
          d.updater = function (node, base, extra) {
            const resolved = d.segments.map(function (s) {
              return s.t === 'text' ? s.v : resolveSegmentValue(s, base, extra);
            }).join('');
            if (node.nodeValue !== resolved) node.nodeValue = resolved;
          };
        } else {
          d.updater = function (node, base, extra) {
            const resolved = d.segments.map(function (s) {
              return s.t === 'text' ? s.v : resolveSegmentValue(s, base, extra);
            }).join('');
            setAttr(node, d.name, resolved, false);
          };
        }
      });
      plan._paths = new Map();
      return plan;
    };

    const collectLeafPlanPaths = function (roots) {
      const paths = [];
      const walk = function (node, path) {
        if (node.nodeType === 3) {
          if (node.nodeValue && node.nodeValue.includes('{{')) paths.push(path);
          return;
        }
        if (node.nodeType !== 1) return;
        if (hasAnyDirective(node)) return;
        Array.prototype.forEach.call(node.attributes, function (attr) {
          const name = attr.name;
          if (name.startsWith('kniu:') || name.startsWith('kniu@')) return;
          if (!attr.value.includes('{{')) return;
          paths.push(path);
        });
        Array.prototype.forEach.call(node.childNodes, function (child, i) {
          walk(child, path.concat(i));
        });
      };
      roots.forEach(function (root, ri) { walk(root, [ri]); });
      return paths;
    };

    const applyLeafPlan = function (plan, nodeMap, base, extra, bucket) {
      plan.forEach(function (d) {
        const node = nodeMap ? (nodeMap.get(d.node) || d.node) : d.node;
        d.updater(node, base, extra);
        d.segments.filter(function (s) { return s.t === 'key'; }).forEach(function (s) {
          const fn = function () { return d.updater(node, base, extra); };
          if (s.fast) {
            s.fast.fastPaths.forEach(function (p) {
              if (isTraversalStep(s.k, p, extra)) return;
              subscribePath(base, p, fn, bucket, extra);
            });
            return;
          }
          let paths = plan._paths.get(s.k);
          if (!paths) {
            paths = evalExpr(s.k, base, extra).paths;
            plan._paths.set(s.k, paths);
          }
          paths.forEach(function (p) {
            if (isTraversalStep(s.k, p, extra)) return;
            subscribePath(base, p, fn, bucket, extra);
          });
        });
      });
    };

    const leafPlanCache = new WeakMap();
    const bindingPathCache = new WeakMap();
    const directiveFlagCache = new WeakMap();

    const setupFor = function (block, parentExtra, bucket = null) {
      const arrayExpr = extractBracedExpr(directiveAttr(block, 'for'));
      const idxName = directiveAttr(block, 'for-index') || 'index';
      const itemName = directiveAttr(block, 'for-item') || 'item';
      const keyExpr = directiveAttr(block, 'key');
      const useKeyed = !!keyExpr;
      const isTpl = block.tagName === 'TEMPLATE';
      const tpl = isTpl ? block.content : block.cloneNode(true);
      if (!isTpl) {
        ['for', 'for-index', 'for-item', 'key'].forEach(function (name) { return removeDirectiveAttrs(tpl, name); });
      }
      const anchor = document.createComment('kniu:for');
      block.replaceWith(anchor);
      let prevViews = [];
      let subCleanups = [];
      const bc = subCleanups;

      const keyFor = function (item) {
        return keyExpr === '*this' ? item : (function () {
          const k = getPath(item, keyExpr);
          return k === undefined ? item : k;
        })();
      };

      const usesIndex = (function () {
        try {
          const html = block.outerHTML || '';
          const escaped = idxName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp('(^|[^\\w$.])' + escaped + '([^\\w$]|$)').test(html);
        } catch (e) {
          return true;
        }
      })();

      const createView = function () {
        const viewCleanups = [];
        let initialized = false;
        let roots = null;
        let lastItem;
        let lastIndex;
        let leafPlan = null;
        let leafNodeMap = null;
        const leafCleanups = [];
        const nb = useKeyed ? viewCleanups : bc;
        const scopeChanged = function (extra) {
          if (!initialized) return true;
          if (!Object.is(extra[itemName], lastItem)) return true;
          return usesIndex && !Object.is(extra[idxName], lastIndex);
        };
        const build = function (extra) {
          runCleanups(viewCleanups);
          runCleanups(leafCleanups);
          const fragRoots = materializeRoots(tpl);
          let plan = leafPlanCache.get(tpl);
          if (!plan) {
            plan = compileLeafPlan(fragRoots);
            leafPlanCache.set(tpl, plan);
            if (plan) bindingPathCache.set(tpl, collectLeafPlanPaths(fragRoots));
          }
          const bindPaths = plan ? bindingPathCache.get(tpl) : null;
          const nodeMap = new Map();
          if (plan && bindPaths) {
            for (let i = 0; i < bindPaths.length; i++) {
              const p = bindPaths[i];
              let node = fragRoots[p[0]];
              for (let k = 1; k < p.length; k++) node = node.childNodes[p[k]];
              nodeMap.set(plan[i].node, node);
            }
          }
          leafNodeMap = nodeMap;
          let fragHasDirective = directiveFlagCache.get(tpl);
          if (fragHasDirective === undefined) {
            fragHasDirective = fragRoots.some(function (root) {
              return root.nodeType === 1
                && (queryDirectives(root, DIRECTIVE_ATTRS).length > 0 || hasEventAttributes(root));
            });
            directiveFlagCache.set(tpl, fragHasDirective);
          }
          const next = [];
          fragRoots.forEach(function (node) {
            if (node.nodeType === 1) {
              const rootFor = queryDirectives(node, FOR_ATTRS).find(function (n) { return n === node; });
              if (rootFor) {
                const baseline = node.previousSibling;
                const forAnchor = setupFor(rootFor, extra, nb) || node;
                next.push.apply(next, collectSinceBaseline(forAnchor, baseline));
                return;
              }
              const rootIf = queryDirectives(node, IF_ATTRS).find(function (n) { return n === node; });
              if (rootIf) {
                const baseline = node.previousSibling;
                const ifAnchor = setupIf(rootIf, extra, nb) || node;
                next.push.apply(next, collectSinceBaseline(ifAnchor, baseline));
                return;
              }
              setupNestedFor(node, extra, nb);
              setupNestedIf(node, extra, nb);
            }
            if (!fragHasDirective && plan) {
              next.push(node);
              return;
            }
            applyBindings(node, state, extra, nb, refs);
            next.push(node);
          });
          if (!fragHasDirective && plan) applyLeafPlan(plan, nodeMap, state, extra, nb);
          leafPlan = (!fragHasDirective && plan) ? plan : null;
          lastItem = extra[itemName];
          lastIndex = extra[idxName];
          return next;
        };
        const update = function (extra) {
          if (!scopeChanged(extra)) return;
          if (roots && leafPlan) {
            runCleanups(leafCleanups);
            applyLeafPlan(leafPlan, leafNodeMap, state, extra, leafCleanups);
            lastItem = extra[itemName];
            lastIndex = extra[idxName];
            initialized = true;
            return;
          }
          const previous = roots;
          roots = build(extra);
          if (!initialized) {
            initialized = true;
            return;
          }
          previous.forEach(function (oldNode, i) {
            const newNode = roots[i];
            if (!newNode) {
              oldNode.remove();
              return;
            }
            if (oldNode.parentNode) {
              oldNode.parentNode.insertBefore(newNode, oldNode);
              oldNode.remove();
            }
          });
        };
        return { update, getNodes: function () { return roots; }, viewCleanups };
      };

      const render = function () {
        if (!anchor.parentNode) return;
        runCleanups(subCleanups);
        const { value: arr, paths } = evalExpr(arrayExpr, state, parentExtra);
        paths.forEach(function (p) {
          if (isTraversalStep(arrayExpr, p, parentExtra)) return;
          return subscribePath(state, p, render, bc, parentExtra);
        });
        const list = Array.isArray(arr) ? arr : [];
        if (arr && arr[SUBS]) {
          if (!arr[SUBS].has('length')) arr[SUBS].set('length', new Set());
          const s = arr[SUBS].get('length');
          s.add(render);
          bc.push(function () { return s.delete(render); });
        }

        if (!useKeyed) {
          const nextViews = [];
          list.forEach(function (item, index) {
            const extra = { ...parentExtra, [idxName]: index, [itemName]: item };
            let view = prevViews[index];
            if (!view) view = createView();
            view.update(extra);
            nextViews.push(view);
          });
          for (let i = list.length; i < prevViews.length; i++) {
            prevViews[i].getNodes().forEach(function (n) { return n.remove(); });
          }
          const forHost = anchor.parentNode;
          nextViews.forEach(function (v) {
            v.getNodes().forEach(function (node) {
              if (node.parentNode !== forHost) forHost.insertBefore(node, anchor);
            });
          });
          nextViews.forEach(function (v) {
            v.getNodes().forEach(function (node) { return activateDeferredIfs(node); });
          });
          prevViews = nextViews;
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
          usedKeys.add(key);
          nextViews.push(view);
        });
        prevViews.forEach(function (v) {
          if (!usedKeys.has(v.key)) {
            v.viewCleanups.forEach(function (c) { return c(); });
            v.getNodes().forEach(function (n) { return n.remove(); });
          }
        });
        const prevKeys = prevViews.map(function (v) { return v.key; });
        const nextKeys = nextViews.map(function (v) { return v.key; });
        const sameOrder = prevKeys.length === nextKeys.length
          && prevKeys.every(function (k, i) { return k === nextKeys[i]; });
        if (sameOrder) {
          nextViews.forEach(function (v) {
            v.getNodes().forEach(function (node) { return activateDeferredIfs(node); });
          });
        } else {
          let isPrefixExtend = prevKeys.length < nextKeys.length;
          if (isPrefixExtend) {
            for (let i = 0; i < prevKeys.length; i++) {
              if (prevKeys[i] !== nextKeys[i]) { isPrefixExtend = false; break; }
            }
          }
          if (isPrefixExtend) {
            for (let i = prevKeys.length; i < nextViews.length; i++) {
              nextViews[i].getNodes().forEach(function (node) {
                anchor.parentNode.insertBefore(node, anchor);
                activateDeferredIfs(node);
              });
            }
          } else {
            const frag = document.createDocumentFragment();
            nextViews.forEach(function (v) { return v.getNodes().forEach(function (n) { return frag.appendChild(n); }); });
            anchor.parentNode.insertBefore(frag, anchor);
            nextViews.forEach(function (v) {
              v.getNodes().forEach(function (node) { return activateDeferredIfs(node); });
            });
          }
        }
        prevViews = nextViews;
      };

      if (!anchor.parentNode) anchor.__kniuDeferredIfRender = render;
      else render();
      (bucket || listDisposers).push(function () {
        runCleanups(subCleanups);
        prevViews.forEach(function (v) {
          v.viewCleanups.forEach(function (c) { return c(); });
          v.getNodes().forEach(function (n) { return n.remove(); });
        });
      });
      return anchor;
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
          if (hasDirectiveAttr(sib, 'elseif')) {
            chain.push({ node: sib, type: 'elseif' });
            sib = sib.nextSibling;
            continue;
          }
          if (hasDirectiveAttr(sib, 'else')) {
            chain.push({ node: sib, type: 'else' });
            break;
          }
        }
        break;
      }

      const branches = chain.map(function ({ node, type }) {
        const tpl = node.cloneNode(true);
        if (type === 'if' || type === 'elseif') {
          const expr = extractBracedExpr(directiveAttr(node, type) ?? '');
          removeDirectiveAttrs(tpl, type);
          return { type, expr, tpl, value: false };
        }
        removeDirectiveAttrs(tpl, 'else');
        return { type: 'else', expr: null, tpl, value: false };
      });

      const anchor = document.createComment('kniu:if');
      block.replaceWith(anchor);
      chain.slice(1).forEach(function ({ node }) { return node.remove(); });

      let rendered = [];
      const cleanups = [];
      const bc = cleanups;

      const render = function () {
        if (!anchor.parentNode) return;
        runCleanups(cleanups);
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
          paths.forEach(function (p) {
            if (isTraversalStep(b.expr, p, parentExtra)) return;
            return subscribePath(state, p, render, bc, parentExtra);
          });
          b.value = value;
          if (b.value && !chosen) chosen = b;
        }
        if (chosen) {
          const nodes = materializeRoots(chosen.tpl);
          nodes.forEach(function (node) {
            if (node.nodeType === 1) {
              setupNestedFor(node, parentExtra, bc);
              setupNestedIf(node, parentExtra, bc);
            }
            applyBindings(node, state, parentExtra, bc, refs);
            anchor.parentNode.insertBefore(node, anchor);
            activateDeferredIfs(node);
            rendered.push(node);
          });
        }
      };

      if (!anchor.parentNode) anchor.__kniuDeferredIfRender = render;
      else render();
      (bucket || listDisposers).push(function () {
        runCleanups(cleanups);
        rendered.forEach(function (n) { return n.remove(); });
      });
      return anchor;
    };

    const activateDeferredIfs = function (root) {
      if (!root) return;
      const nodes = [root];
      if (typeof document !== 'undefined' && typeof document.createTreeWalker === 'function') {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
        let n;
        while ((n = walker.nextNode())) nodes.push(n);
      } else {
        const walk = function (node) {
          const kids = node.childNodes;
          for (let i = 0; i < kids.length; i++) {
            const c = kids[i];
            if (c.nodeType === 1 || c.nodeType === 8) {
              nodes.push(c);
              if (c.nodeType === 1) walk(c);
            }
          }
        };
        walk(root);
      }
      nodes.forEach(function (node) {
        if (!node.__kniuDeferredIfRender) return;
        const deferred = node.__kniuDeferredIfRender;
        delete node.__kniuDeferredIfRender;
        deferred();
      });
    };

    const setupNestedFor = function (node, extra, bucket) {
      queryDirectives(node, FOR_ATTRS).forEach(function (n) { return setupFor(n, extra, bucket); });
    };
    const setupNestedIf = function (node, extra, bucket) {
      queryDirectives(node, IF_ATTRS).forEach(function (n) { return setupIf(n, extra, bucket); });
    };

    applyBindings(scope, state, {}, subscriptions, refs);

    [...queryDirectives(scope, FOR_ATTRS)]
      .filter(function (b) { return !hasDirectiveAncestor(b); })
      .forEach(function (b) { return setupFor(b, {}); });

    [...queryDirectives(scope, IF_ATTRS)]
      .filter(function (b) { return !hasDirectiveAncestor(b); })
      .forEach(function (b) { return setupIf(b, {}); });

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
    neutralizeTemplateUrls: neutralizeTemplateUrls,
    nextTick: nextTick,
    beginBindingCollection: beginBindingCollection,
    endBindingCollection: endBindingCollection,
    bind: bind
  };
}());

export default KniuTemplate;