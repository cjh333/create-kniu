import { reactive, computed, watch } from '../Kniu-MVVM.mjs';
import { kniuWarn, KNDEBUG } from '../Kniu-Debug.mjs';
import { registerModal } from './Kniu-ModalComponent/Kniu-ModalComponent.mjs';

let componentDefaults = {};
let themeHostCss = '';

export function getComponentDefaults() {
  return componentDefaults;
}

export function getThemeHostCss() {
  return themeHostCss;
}

function assertCustomTag(tagName, apiName) {
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') {
    kniuWarn(KNDEBUG.COMPONENT, '[KNIU] ' + apiName + '("' + tagName + '") ignored: custom element registry unavailable');
    return false;
  }
  if (typeof tagName !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(tagName)) {
    kniuWarn(KNDEBUG.COMPONENT, '[KNIU] ' + apiName + '("' + tagName + '") rejected: tag must be lowercase and contain a hyphen, e.g. "app-rating"');
    return false;
  }
  if (tagName.indexOf('kniu-') === 0) {
    kniuWarn(KNDEBUG.COMPONENT, '[KNIU] ' + apiName + '("' + tagName + '") rejected: "kniu-" prefix is reserved for built-in components');
    return false;
  }
  if (customElements.get(tagName)) {
    kniuWarn(KNDEBUG.COMPONENT, '[KNIU] ' + apiName + '("' + tagName + '") skipped: already defined');
    return false;
  }
  return true;
}

function adoptDocumentRootStyle(cssText) {
  const documentRef = globalThis.document;
  if (!documentRef || !cssText) return;
  if (typeof CSSStyleSheet === 'function' && Array.isArray(documentRef.adoptedStyleSheets)) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    if (!documentRef.adoptedStyleSheets.includes(sheet)) {
      documentRef.adoptedStyleSheets = [...documentRef.adoptedStyleSheets, sheet];
    }
    return;
  }
  const styleElement = documentRef.createElement('style');
  styleElement.textContent = cssText;
  (documentRef.head || documentRef.documentElement).appendChild(styleElement);
}

function use(config = {}) {
  const components = config.COMPONENTS && typeof config.COMPONENTS === 'object' ? config.COMPONENTS : {};
  Object.keys(components).forEach(function (name) {
    const tag = String(name).toLowerCase().startsWith('kniu-') ? String(name).toLowerCase() : 'kniu-' + String(name).toLowerCase();
    componentDefaults[tag] = { ...(componentDefaults[tag] || {}), ...(components[name] || {}) };
  });
  globalThis.__KNIU_UI_DEFAULTS__ = componentDefaults;
  const theme = config.THEME && typeof config.THEME === 'object' ? config.THEME : {};
  const themeEntries = Object.entries(theme).filter(function (entry) {
    return String(entry[0]).startsWith('--kniu-');
  });
  themeHostCss = themeEntries.length
    ? ':host{' + themeEntries.map(function (entry) { return entry[0] + ':' + String(entry[1]); }).join(';') + '}'
    : '';
  if (themeEntries.length) {
    const globalThemeCSS = ':root {\n' +
      themeEntries
        .map(function (entry) { return '  ' + entry[0] + ': ' + String(entry[1]); })
        .join(';\n') + '\n}';
    adoptDocumentRootStyle(globalThemeCSS);
  }
  return Object.freeze({ components: { ...componentDefaults }, theme: { ...theme } });
}

const TEMPLATE = {
  reactive,
  nextTick(callback) { return Promise.resolve().then(callback); },
  bind(_root, state) { return { state, dispose() { } }; }
};

function useComponent(context, spec) {
  const attachShadowHost = context && typeof context.attachComponentShadow === 'function'
    ? context.attachComponentShadow
    : function (host) {
      const root = host.attachShadow({ mode: 'open' });
      if (themeHostCss) {
        const styleElement = host.ownerDocument.createElement('style');
        styleElement.textContent = themeHostCss;
        root.appendChild(styleElement);
      }
      return root;
    };
  const tag = spec && spec.tag;
  if (!assertCustomTag(tag, 'useComponent')) return;
  if (typeof spec.setup !== 'function') {
    kniuWarn(KNDEBUG.COMPONENT, '[KNIU] useComponent("' + tag + '") rejected: spec.setup(ctx) must return { state, ...actions }');
    return;
  }
  const style = typeof spec.style === 'string' ? spec.style : '';
  const template = typeof spec.template === 'string' ? spec.template : '';
  class KniuCustomComponent extends HTMLElement {
    static slots = Array.isArray(spec.slots) ? new Set(spec.slots.filter(function (name) { return typeof name === 'string' && name; })) : null;

    constructor() {
      super();
      attachShadowHost(this);
      if (style) {
        const styleNode = document.createElement('style');
        styleNode.textContent = style;
        this.shadowRoot.appendChild(styleNode);
      }
      if (template) {
        const root = document.createElement('div');
        root.innerHTML = template;
        this.shadowRoot.appendChild(root);
        this._root = root;
      } else {
        this._root = this.shadowRoot;
      }
      this._binding = null;
      this._pending = null;
      this._hooks = { beforeMount: [], mounted: [], unmounted: [], routeChange: [] };
      this._built = false;
    }
    connectedCallback() {
      if (this._built) return;
      this._built = true;
      const self = this;
      function registerHook(bucket, fn) {
        if (typeof fn !== 'function') throw new TypeError('[KNIU] useComponent("' + tag + '") lifecycle hook must be a function');
        self._hooks[bucket].push(fn);
      }
      function runHooks(bucket) {
        self._hooks[bucket].forEach(function (fn) { fn.call(self, self); });
      }
      this.__kniuRouteChange = function (payload) {
        self._hooks.routeChange.forEach(function (fn) { fn.call(self, payload, self); });
      };
      const ctx = {
        host: this,
        reactive: TEMPLATE.reactive,
        computed,
        watch,
        refs: {},
        emit: this.emit.bind(this),
        root: this.shadowRoot,
        nextTick: TEMPLATE.nextTick,
        onBeforeMount: function (fn) { registerHook('beforeMount', fn); },
        onMounted: function (fn) { registerHook('mounted', fn); },
        onUnmounted: function (fn) { registerHook('unmounted', fn); },
        onRouteChange: function (fn) { registerHook('routeChange', fn); }
      };
      const bindings = spec.setup.call(ctx, ctx) || {};
      let state = bindings.state;
      if (!state || typeof state !== 'object') {
        kniuWarn(KNDEBUG.COMPONENT, '[KNIU] useComponent("' + tag + '") setup must return { state, ...actions }');
        return;
      }
      if (this._pending && typeof this._pending === 'object') Object.assign(state, this._pending);
      this._syncReadonly(state);
      runHooks('beforeMount');
      this._binding = TEMPLATE.bind(this._root, state);
      runHooks('mounted');
    }
    disconnectedCallback() {
      if (!this._built) return;
      this._hooks.unmounted.forEach(function (fn) { fn.call(this, this); }, this);
      if (this._binding && typeof this._binding.dispose === 'function') this._binding.dispose();
      this._binding = null;
      this._built = false;
    }
    emit(name, detail) {
      this.dispatchEvent(new CustomEvent(name, { detail: detail, bubbles: true, composed: true }));
    }
    get options() {
      return this._binding ? Object.assign({}, this._binding.state) : Object.assign({}, this._pending);
    }
    set options(value) {
      const o = value && typeof value === 'object' ? value : {};
      if (this._binding) {
        Object.assign(this._binding.state, o);
      } else {
        this._pending = Object.assign({}, this._pending, o);
      }
      this._syncReadonly(o);
    }
    _syncReadonly(state) {
      this.toggleAttribute('readonly', state.readonly === true);
    }
  }
  customElements.define(tag, KniuCustomComponent);
}

function confirm(context, message, title = '提示', options = {}) {
  if (typeof document === 'undefined') return Promise.resolve(false);
  registerModal(context);
  const modal = document.createElement('kniu-modal');
  modal.confirm = true;
  modal.title = title;
  modal.message = message;
  document.body.append(modal);
  modal.options = { ...(options || {}) };
  modal.show = true;
  return new Promise((resolve, reject) => {
    const onConfirm = () => { cleanup(); resolve('confirm'); };
    const onCancel = () => { cleanup(); reject('cancel'); };
    function cleanup() {
      modal.removeEventListener('confirm', onConfirm);
      modal.removeEventListener('cancel', onCancel);
      setTimeout(() => { if (modal.parentNode) modal.remove(); }, 320);
    }
    modal.addEventListener('confirm', onConfirm);
    modal.addEventListener('cancel', onCancel);
  });
}

function defineComponent(context, tagName, registerFn) {
  if (!assertCustomTag(tagName, 'defineComponent')) return;
  if (typeof registerFn !== 'function') {
    kniuWarn(KNDEBUG.COMPONENT, '[KNIU] defineComponent("' + tagName + '") rejected: second argument must be a register function (context) => void');
    return;
  }
  registerFn(context);
}

export function createUiEssential(context) {
  return {
    use,
    useComponent: function (spec) { return useComponent(context, spec); },
    confirm: function (message, title, options) { return confirm(context, message, title, options); },
    defineComponent: function (tagName, registerFn) { return defineComponent(context, tagName, registerFn); },
    registerBusinessComponents: function () { }
  };
}