import { escapeHtml, evaluateTemplateExpression } from './Kniu-TemplateEngine.mjs';
import { getContracts } from './Kniu-Contracts.mjs';
import { maskExternalImages, hydrateExternalImages } from './Kniu-Proxy.mjs';
import { watch } from './Kniu-MVVM.mjs';

export function retargetEvent(event, node) {
  if (event.currentTarget === node) return event;
  return new Proxy(event, {
    get(target, property) {
      if (property === 'currentTarget') return node;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, property, value) { return Reflect.set(target, property, value, target); }
  });
}

export function parseEventDescriptor(eventName) {
  const descriptor = String(eventName || '').split('.');
  return { name: descriptor.shift(), modifiers: new Set(descriptor) };
}

export function splitArguments(source) {
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

export function parseEventArgument(source, model, event) {
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

export function setPath(scope, path, value) {
  const keys = path.replace(/^{{\s*|\s*}}$/g, '').trim().split('.');
  let target = scope;
  keys.slice(0, -1).forEach((key) => { target = target[key] ?? (target[key] = {}); });
  const field = target[keys.at(-1)];
  if (field && typeof field === 'object' && Object.prototype.hasOwnProperty.call(field, 'value')) {
    field.value = value;
  } else {
    target[keys.at(-1)] = value;
  }
}

export function resolveModelPath(scope, path) {
  const expression = String(path || '').trim().replace(/^{{\s*|\s*}}$/g, '').trim();
  const keys = expression.split('.');
  if (!keys.length || keys.some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))) return undefined;
  return keys.reduce((value, key) => (value == null ? undefined : value[key]), scope);
}

export function createBinder(options = {}) {
  const actions = options.actions || {};
  const onLinkClick = typeof options.onLinkClick === 'function' ? options.onLinkClick : null;
  const submissionKeyOf = typeof options.submissionKey === 'function'
    ? options.submissionKey
    : (node, name) => `${name}:${node.localName}`;
  let textBindings = new Map();
  let lastModel = {};
  let suppressRender = false;
  const pendingSubmissions = new Map();

  function collectTextBindings(host, reset = true) {
    if (reset) textBindings = new Map();
    const comments = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_COMMENT);
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach(function (node) {
      const data = String(node.data || '');
      const start = /^kniu-t:(.+)$/.exec(data);
      if (!start) { if (data === '/kniu-t') node.remove(); return; }
      const [encoded, rawFlag] = start[1].split('|raw');
      const isRaw = rawFlag !== undefined;
      let next = node.nextSibling;
      if (isRaw) {
        const nodes = [];
        let end = null;
        while (next) {
          if (next.nodeType === Node.COMMENT_NODE && next.data === '/kniu-t') { end = next; break; }
          nodes.push(next);
          next = next.nextSibling;
        }
        const anchor = document.createTextNode('');
        node.after(anchor);
        anchor.after(...nodes);
        const expr = decodeURIComponent(encoded);
        const key = `${expr}|1`;
        const entry = textBindings.get(key) || { expr, raw: true, nodes: [], anchor };
        entry.nodes = nodes;
        entry.anchor = anchor;
        textBindings.set(key, entry);
        node.remove();
        if (end) end.remove();
        return;
      }
      if (next && next.nodeType === Node.COMMENT_NODE && next.data === '/kniu-t') {
        next = next.parentNode.insertBefore(document.createTextNode(''), next);
      }
      if (next && next.nodeType === Node.TEXT_NODE) {
        const expr = decodeURIComponent(encoded);
        const key = `${expr}|0`;
        const entry = textBindings.get(key) || { expr, raw: isRaw, nodes: [] };
        entry.nodes.push(next);
        textBindings.set(key, entry);
      }
      node.remove();
    });
  }

  function patchRawBinding(entry) {
    const value = String(evaluateTemplateExpression(entry.expr, lastModel) ?? '');
    const anchor = entry.anchor;
    if (!anchor || !anchor.isConnected) return;
    const template = document.createElement('template');
    template.innerHTML = maskExternalImages(value);
    const fragment = template.content;
    const replacement = Array.from(fragment.childNodes);
    anchor.parentNode.insertBefore(fragment, anchor);
    entry.nodes.forEach((node) => node.remove());
    entry.nodes = replacement;
    void hydrateExternalImages(anchor.parentNode);
  }

  function patchTextBindings() {
    textBindings.forEach(function (entry) {
      if (entry.raw) { patchRawBinding(entry); return; }
      const value = escapeHtml(evaluateTemplateExpression(entry.expr, lastModel));
      entry.nodes.forEach(function (node) { if (node.textContent !== value) node.textContent = value; });
    });
  }

  function patchAttrBindings(scope, model) {
    scope.querySelectorAll?.('[data-kniu-attr]')?.forEach?.(function (element) {
      const marks = String(element.dataset.kniuAttr || '').split(' ');
      marks.forEach(function (pair) {
        const sep = pair.indexOf(':');
        if (sep < 0) return;
        const attributeName = pair.slice(0, sep);
        const code = decodeURIComponent(pair.slice(sep + 1));
        let value = /\{\{[\s\S]*?\}\}/.test(code)
          ? code.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, token) => String(evaluateTemplateExpression(token, model) ?? ''))
          : evaluateTemplateExpression(code, model);
        if (value && typeof value === 'object') return;
        if (value === '' || value == null || value === false) {
          if (attributeName === 'class' || attributeName === 'style') {
            if (element.hasAttribute(attributeName)) element.removeAttribute(attributeName);
            return;
          }
          value = '';
        }
        const nextValue = String(value);
        if (element.getAttribute(attributeName) !== nextValue) element.setAttribute(attributeName, nextValue);
      });
    });
  }

  let renderedHtmlSnapshot = '';
  let renderedHtmlRoute = '';
  let renderedHtmlSource = '';

  function recordRenderedHtml(html, routePath, source) {
    renderedHtmlSnapshot = String(html || '');
    renderedHtmlRoute = String(routePath || '');
    renderedHtmlSource = String(source || '');
  }

  function renderedHtmlMatches(html, routePath) {
    return renderedHtmlRoute === String(routePath || '') && renderedHtmlSnapshot === String(html || '');
  }

  function lastRenderedSource() {
    return renderedHtmlRoute ? renderedHtmlSource : '';
  }

  function invokeKniuEvent(node, eventName, handlerCode, model, event) {
    const { name, modifiers } = parseEventDescriptor(eventName);
    const bound = retargetEvent(event, node);
    if (modifiers.has('once')) {
      const onceKey = `${eventName}|${handlerCode}`;
      node.__kniuOnceFired = node.__kniuOnceFired || new Set();
      if (node.__kniuOnceFired.has(onceKey)) return;
      node.__kniuOnceFired.add(onceKey);
    }
    if (modifiers.has('enter') && event.key !== 'Enter') return;
    if (modifiers.has('esc') && event.key !== 'Escape') return;
    if (modifiers.has('tab') && event.key !== 'Tab') return;
    if (modifiers.has('exact') && (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)) return;
    if (modifiers.has('ctrl') && !event.ctrlKey) return;
    if (modifiers.has('shift') && !event.shiftKey) return;
    if (modifiers.has('alt') && !event.altKey) return;
    if (modifiers.has('meta') && !event.metaKey) return;
    if (modifiers.has('self') && event.target !== node) return;
    if (modifiers.has('prevent')) event.preventDefault();
    if (modifiers.has('stop')) event.stopPropagation();
    const isSubmission = (name === 'submit' && node.localName === 'kniu-form')
      || (name === 'click' && node.localName === 'kniu-btn' && node.getAttribute('native-type') === 'submit');
    const submissionScope = () => node.closest('kniu-modal') || node.closest('kniu-form');
    const submissionKey = () => submissionKeyOf(node, name);
    const lockScope = (entry, scope) => {
      if (!scope || entry.scopes.has(scope)) return;
      entry.scopes.set(scope, { inert: scope.hasAttribute('inert'), busy: scope.getAttribute('aria-busy') });
      scope.setAttribute('inert', '');
      scope.setAttribute('aria-busy', 'true');
    };
    const call = /^([\w$]+)(?:\((.*)\))?$/.exec(handlerCode);
    const handlerName = call?.[1] || handlerCode;
    const handler = actions[handlerName] || model[handlerName];
    if (typeof handler !== 'function') return;
    const args = call?.[2] ? splitArguments(call[2]).map((item) => parseEventArgument(item, model, bound)) : [bound];
    if (!isSubmission) { handler.apply(model, args); return; }
    const key = submissionKey();
    if (pendingSubmissions.has(key)) { event.preventDefault(); return; }
    const entry = { scopes: new Map() };
    pendingSubmissions.set(key, entry);
    lockScope(entry, submissionScope());
    const unlock = () => {
      if (pendingSubmissions.get(key) !== entry) return;
      pendingSubmissions.delete(key);
      entry.scopes.forEach((previous, scope) => {
        if (!previous.inert) scope.removeAttribute('inert');
        if (previous.busy === null) scope.removeAttribute('aria-busy');
        else scope.setAttribute('aria-busy', previous.busy);
      });
    };
    try {
      const result = handler.apply(model, args);
      if (result && typeof result.then === 'function') Promise.resolve(result).then(unlock, unlock);
      else unlock();
    } catch (error) { unlock(); throw error; }
  }

  const delegationScopes = new WeakMap();
  const documentDelegationTypes = new Set();
  const attachedListeners = [];
  const DELEGATION_BASE_TYPES = ['click', 'input', 'change', 'keydown', 'submit'];
  const delegatedModel = (node) => node.__kniuModel || lastModel;

  function shouldInterceptLink(node, event) {
    if (node.localName !== 'a') return false;
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (node.hasAttribute('target') || node.hasAttribute('download')) return false;
    if ((node.getAttribute('rel') || '').split(/\s+/).includes('external')) return false;
    const href = node.getAttribute('href') || '';
    if (!href) return false;
    if (onLinkClick) return onLinkClick(href, event, node) === true;
    const contracts = getContracts();
    const router = contracts.router || {};
    return typeof router.isInternalLink === 'function'
      ? router.isInternalLink(href, router.mode || 'hash', contracts)
      : href.startsWith('#/');
  }

  const processDelegatedNode = (node, event) => {
    const type = event.type;
    if (type === 'click') {
      if (shouldInterceptLink(node, event)) {
        event.preventDefault();
        const href = node.getAttribute('href') || '';
        if (!onLinkClick) options.navigate?.(href);
      }
      const actionName = node.getAttribute('data-action');
      if (actionName && typeof actions[actionName] === 'function') actions[actionName].call(node, retargetEvent(event, node));
    }
    if ((type === 'input' || type === 'change') && node.hasAttribute('data-kniu-form')) {
      const path = decodeURIComponent(node.dataset.kniuForm || '');
      const model = delegatedModel(node);
      suppressRender = true;
      setPath(model, path, node.value);
      suppressRender = false;
    }
    if (node.hasAttribute('data-kniu-event')) {
      const model = delegatedModel(node);
      [...node.attributes].forEach((attribute) => {
        const match = /^data-kniu-event(?:-(\d+))?$/.exec(attribute.name);
        if (!match) return;
        if (parseEventDescriptor(attribute.value).name !== type) return;
        const suffix = match[1] ? `-${match[1]}` : '';
        const handlerCode = node.getAttribute(`data-kniu-handler${suffix}`);
        if (handlerCode == null) return;
        invokeKniuEvent(node, attribute.value, decodeURIComponent(handlerCode), model, event);
      });
    }
  };
  const dispatchDelegated = (event, scope) => {
    const path = event.composedPath();
    const limit = path.indexOf(scope);
    if (limit === -1) return;
    const boundary = event.__kniuDelegatedBoundary;
    let start = 0;
    if (boundary) {
      const index = path.indexOf(boundary);
      if (index !== -1) start = index + 1;
    }
    event.__kniuDelegatedBoundary = scope;
    for (let i = start; i <= limit; i++) {
      const node = path[i];
      if (node instanceof Element) processDelegatedNode(node, event);
      if (event.cancelBubble) return;
    }
  };
  const ensureDelegation = (scope, types) => {
    let attached = delegationScopes.get(scope);
    if (!attached) {
      attached = new Set();
      delegationScopes.set(scope, attached);
    }
    for (const type of types) {
      if (attached.has(type)) continue;
      attached.add(type);
      const handler = (event) => dispatchDelegated(event, scope);
      scope.addEventListener(type, handler);
      attachedListeners.push({ target: scope, type, handler });
    }
    for (const type of types) {
      if (documentDelegationTypes.has(type)) continue;
      documentDelegationTypes.add(type);
      const handler = (event) => dispatchDelegated(event, document);
      document.addEventListener(type, handler);
      attachedListeners.push({ target: document, type, handler });
    }
  };

  function syncFormValue(element, model) {
    const path = decodeURIComponent(element.dataset.kniuForm || '');
    const initialValue = resolveModelPath(model, path);
    const value = initialValue && typeof initialValue === 'object'
      && Object.prototype.hasOwnProperty.call(initialValue, 'value')
      ? initialValue.value
      : initialValue;
    if ('value' in element && value !== undefined && element.value !== String(value ?? '')) {
      element.value = value ?? '';
    }
  }

  function bindOptionRefWatchers(element, model) {
    (element.__kniuOptionRefStops || []).forEach((stop) => stop());
    element.__kniuOptionRefStops = [];
    const refAttribute = element.getAttribute('data-kniu-option-ref') || '';
    if (!refAttribute) return;
    refAttribute.split(',').forEach((pair) => {
      const colon = pair.indexOf(':');
      if (colon === -1) return;
      const key = pair.slice(0, colon).trim();
      const path = pair.slice(colon + 1);
      element.__kniuOptionRefStops.push(watch(() => resolveModelPath(model, path), (value) => {
        if (!element.isConnected) {
          (element.__kniuOptionRefStops || []).forEach((stop) => stop());
          element.__kniuOptionRefStops = [];
          return;
        }
        if (value === undefined) return;
        const current = element.__kniuOptionsValue;
        if (!current || current[key] === value) return;
        current[key] = value;
        if (element.localName.startsWith('kniu-') && 'options' in element) element.options = current;
      }, { immediate: false }));
    });
  }

  function bind(model, scope, updateOnly = false) {
    if (!updateOnly) {
      const types = new Set(DELEGATION_BASE_TYPES);
      scope.querySelectorAll('[data-kniu-form]').forEach((element) => {
        element.__kniuModel = model;
        syncFormValue(element, model);
      });
      scope.querySelectorAll('[data-kniu-event]').forEach((element) => {
        element.__kniuModel = model;
        [...element.attributes].forEach((attribute) => {
          if (/^data-kniu-event/.test(attribute.name)) types.add(String(attribute.value).split('.')[0]);
        });
      });
      ensureDelegation(scope, types);
    } else {
      scope.querySelectorAll('[data-kniu-form]').forEach((element) => syncFormValue(element, model));
    }
    const optionElements = [];
    const collectOptionElements = (fragment) => {
      optionElements.push(...fragment.querySelectorAll('[data-kniu-option-keys]'));
      fragment.querySelectorAll('template').forEach((template) => collectOptionElements(template.content));
    };
    collectOptionElements(scope);
    if (scope.matches?.('[data-kniu-option-keys]')) optionElements.push(scope);
    const bindTemplateEvents = (fragment) => {
      fragment.querySelectorAll('[data-kniu-event]').forEach((element) => {
        const name = element.getAttribute('data-kniu-event');
        const code = element.getAttribute('data-kniu-handler');
        if (!name || code == null) return;
        const invoke = (event, ...tableArgs) => {
          const handler = actions[decodeURIComponent(code)] || model[decodeURIComponent(code)];
          if (typeof handler === 'function') {
            if (tableArgs.length) return handler.call(model, ...tableArgs);
            const detail = event.detail;
            if (detail && Array.isArray(detail.rows)) handler.call(model, detail.index, detail.rows);
            else handler.call(model, event);
          }
        };
        if (element.localName === 'kniu-switch' || element.localName === 'kniu-radio-group') {
          element.__kniuTableScopedHandler = (...args) => invoke(null, ...args);
        }
        element.addEventListener(name.split('.')[0], (event) => invoke(event));
      });
      fragment.querySelectorAll('template').forEach((template) => bindTemplateEvents(template.content));
    };
    if (!updateOnly) scope.querySelectorAll('template').forEach((template) => bindTemplateEvents(template.content));
    optionElements.forEach((element) => {
      const optionsValue = {};
      (element.getAttribute('data-kniu-option-object') || '').split(',').forEach((path) => {
        const value = resolveModelPath(model, path);
        if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(optionsValue, value);
      });
      element.dataset.kniuOptionKeys.split(',').forEach((key) => {
        if (!key) return;
        const attributeName = key.replace(/[A-Z]/g, (character) => '-' + character.toLowerCase());
        const previousOptions = element.__kniuOptionsValue || {};
        if (!element.hasAttribute(attributeName) && Object.prototype.hasOwnProperty.call(previousOptions, key)) {
          optionsValue[key] = previousOptions[key];
          return;
        }
        if (element.hasAttribute(attributeName) && element.getAttribute(attributeName) === '' && previousOptions[key] === true) {
          optionsValue[key] = true;
          return;
        }
        const value = element.hasAttribute(attributeName) ? element.getAttribute(attributeName) : '';
        optionsValue[key] = value === 'true' ? true : value === 'false' ? false : /^-?\d+\.?\d*$/.test(value) ? Number(value) : value;
      });
      (element.getAttribute('data-kniu-option-ref') || '').split(',').forEach((pair) => {
        const colon = pair.indexOf(':');
        if (colon === -1) return;
        const value = resolveModelPath(model, pair.slice(colon + 1));
        if (value !== undefined) optionsValue[pair.slice(0, colon).trim()] = value;
      });
      bindOptionRefWatchers(element, model);
      element.__kniuOptionsValue = optionsValue;
      if (element.localName.startsWith('kniu-') && 'options' in element) element.options = optionsValue;
    });
  }

  return {
    collectTextBindings,
    patchTextBindings,
    patchAttrBindings,
    recordRenderedHtml,
    renderedHtmlMatches,
    lastRenderedSource,
    bind,
    retargetEvent,
    get textBindings() { return textBindings; },
    get lastModel() { return lastModel; },
    setModel(model) { lastModel = model; },
    get suppressRender() { return suppressRender; },
    setSuppressRender(value) { suppressRender = Boolean(value); },
    resetDelegation() {
      attachedListeners.splice(0).forEach(({ target, type, handler }) => {
        target?.removeEventListener?.(type, handler);
        delegationScopes.get(target)?.delete(type);
      });
      documentDelegationTypes.clear();
      pendingSubmissions.clear();
    },
    attachedListeners,
    hasPendingSubmission: (key) => pendingSubmissions.has(key)
  };
}