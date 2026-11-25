import { scopeGet } from './Kniu-Scope.mjs';
import { KNDEBUG, kniuWarn } from './Kniu-Debug.mjs';

const MAX_EVENTS = 200;
const MAX_SNAPSHOTS = 40;
const MAX_FIELD_CHARS = 8192;
const MAX_RENDERS = 200;
const events = [];
const snapshots = [];
const renders = [];
let snapshotSeq = 0;
let panelModulePromise = null;

const now = () => (globalThis.performance?.now?.() ?? Date.now());

function domDepth(node) {
  let depth = 0;
  let current = node;
  while (current && depth < 12) {
    if (current.parentElement) current = current.parentElement;
    else {
      const root = current.getRootNode?.();
      current = root && root.host ? root.host : null;
    }
    depth += 1;
  }
  return depth;
}

function beginComponentRender(tag, node) {
  if (!tag) return null;
  return { tag: String(tag), start: now(), depth: node ? Math.max(0, domDepth(node) - 1) : 0 };
}

function endComponentRender(token) {
  if (!token) return;
  renders.push({ tag: token.tag, start: token.start, duration: now() - token.start, depth: token.depth });
  if (renders.length > MAX_RENDERS) renders.splice(0, renders.length - MAX_RENDERS);
}

globalThis.__KNIU_PROFILE__ = { begin: beginComponentRender, end: endComponentRender };

function instrumentCustomElements() {
  const registry = globalThis.customElements;
  if (!registry || typeof registry.define !== 'function') return;
  const originalDefine = registry.define;
  registry.define = function (name, ctor, options) {
    const proto = ctor?.prototype;
    const originalConnected = proto && proto.connectedCallback;
    if (typeof originalConnected === 'function' && !proto.__kniuProfiled) {
      proto.connectedCallback = function () {
        const token = beginComponentRender(name, this);
        try { return originalConnected.apply(this, arguments); }
        finally { endComponentRender(token); }
      };
      proto.__kniuProfiled = true;
    }
    return originalDefine.call(registry, name, ctor, options);
  };
}

instrumentCustomElements();

function record(event) {
  events.push({ ...event, time: Date.now() });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

function cloneSerializable(value) {
  if (value === null) return null;
  const type = typeof value;
  if (type === 'string') return value.length > MAX_FIELD_CHARS ? undefined : value;
  if (type === 'number' || type === 'boolean') return value;
  if (type !== 'object') return undefined;
  try {
    const text = JSON.stringify(value);
    if (text === undefined || text.length > MAX_FIELD_CHARS) return undefined;
    return JSON.parse(text);
  } catch (error) {
    return undefined;
  }
}

function currentModel() {
  const host = document.querySelector('[data-kniu-route-view]');
  return host?.shadowRoot?.querySelector('[data-kniu-event]')?.__kniuModel || null;
}

function captureSnapshot(label) {
  const model = currentModel();
  if (!model) return null;
  const data = {};
  const skipped = [];
  Object.keys(model).forEach((key) => {
    const value = cloneSerializable(model[key]);
    if (value === undefined) { skipped.push(key); return; }
    data[key] = value;
  });
  snapshotSeq += 1;
  const snapshot = {
    id: snapshotSeq,
    label: String(label || ''),
    time: Date.now(),
    fields: Object.keys(data).length,
    skipped,
    data
  };
  snapshots.push(snapshot);
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
  return snapshot;
}

function restoreSnapshot(id) {
  const snapshot = snapshots.find((item) => item.id === Number(id));
  if (!snapshot) return false;
  const model = currentModel();
  if (!model) return false;
  Object.keys(snapshot.data).forEach((key) => {
    if (!(key in model)) return;
    const value = cloneSerializable(snapshot.data[key]);
    if (value !== undefined) model[key] = value;
  });
  globalThis.dispatchEvent?.(new CustomEvent('kniu:state-restored', { detail: { id: snapshot.id } }));
  return true;
}

function inspectView() {
  const host = document.querySelector('[data-kniu-route-view]');
  if (!host) return null;
  const root = host.shadowRoot;
  const components = {};
  const componentAttrs = [];
  if (root) {
    root.querySelectorAll('*').forEach((element) => {
      const tag = element.localName;
      if (!tag.includes('-')) return;
      components[tag] = (components[tag] || 0) + 1;
      if (componentAttrs.length >= 30) return;
      const attrs = {};
      for (const attr of element.attributes) {
        if (attr.name === 'style' || attr.name === 'class') continue;
        attrs[attr.name] = attr.value.length > 60 ? `${attr.value.slice(0, 60)}…` : attr.value;
      }
      componentAttrs.push({ tag, attrs });
    });
  }
  let modelKeys = null;
  let model = null;
  const withEvents = root?.querySelector('[data-kniu-event]');
  if (withEvents?.__kniuModel) {
    model = withEvents.__kniuModel;
    try { modelKeys = Object.keys(model).slice(0, 60); } catch { }
  }
  return { view: host.localName, components, componentAttrs, modelKeys, model };
}

function openPanel() {
  if (!panelModulePromise) {
    panelModulePromise = import('./Kniu-DevtoolsPanel.mjs').catch((error) => {
      kniuWarn(KNDEBUG.DEBUG, '[kniu-devtools] 面板加载失败：', error);
      panelModulePromise = null;
    });
  }
  return panelModulePromise.then((module) => module.openDevtoolsPanel({
    getEvents,
    getSnapshots,
    getRenders,
    restoreSnapshot,
    inspectView
  }));
}

const propSnapshots = new WeakMap();
let propsObserver = null;

function readRouteRoot() {
  return document.querySelector('[data-kniu-route-view]')?.shadowRoot || null;
}

function collectProps(node) {
  const attrs = {};
  for (const attr of node.attributes) {
    if (attr.name === 'style' || attr.name === 'class') continue;
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

function diffProps(node) {
  if (!node.localName?.includes('-')) return;
  const next = collectProps(node);
  const previous = propSnapshots.get(node);
  propSnapshots.set(node, next);
  if (!previous) return;
  Object.keys(next).forEach((name) => {
    if (previous[name] === next[name]) return;
    record({
      type: 'props',
      tag: node.localName,
      name,
      from: previous[name] ?? '',
      to: next[name]
    });
  });
}

function restartPropsObserver() {
  propsObserver?.disconnect();
  propsObserver = null;
  const root = readRouteRoot();
  if (!root || typeof MutationObserver === 'undefined') return;
  propSnapshots.delete(root.host);
  propsObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') diffProps(mutation.target);
      else mutation.addedNodes.forEach((node) => { if (node.nodeType === 1) diffProps(node); });
    });
  });
  propsObserver.observe(root, { attributes: true, subtree: true, childList: true });
  root.querySelectorAll('*').forEach(diffProps);
}

function stopPropsObserver() {
  propsObserver?.disconnect();
  propsObserver = null;
}

function togglePanel() {
  const existing = document.querySelector('kniu-devtools-panel');
  if (existing) { existing.remove(); stopPropsObserver(); return; }
  restartPropsObserver();
  void openPanel();
}

function installShortcuts() {
  if (typeof document === 'undefined') return;
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && (event.key === 'K' || event.key === 'k')) {
      event.preventDefault();
      togglePanel();
    }
  });
  try {
    if (new URLSearchParams(location.search).get('kniu-devtools') === '1') {
      restartPropsObserver();
      void openPanel();
    }
  } catch { }
}

export function getEvents() {
  return events.slice();
}

export function getSnapshots() {
  return snapshots.slice().reverse();
}

export function getRenders() {
  return renders.slice();
}

export function recordRoute(path, viewTag, elapsedMs) {
  record({ type: 'route', path, viewTag, elapsedMs: Math.round(elapsedMs * 10) / 10 });
  captureSnapshot(path);
  if (document.querySelector('kniu-devtools-panel')) restartPropsObserver();
}

export function recordComponent(tag, count) {
  record({ type: 'components', tag, count });
}

export function devtools() {
  return {
    getEvents,
    getSnapshots,
    getRenders,
    captureSnapshot,
    restoreSnapshot,
    inspectView,
    togglePanel,
    openPanel,
    recordRoute,
    recordComponent
  };
}

const devtoolsApi = devtools();
globalThis.__KNIU_DEVTOOLS__ = devtoolsApi;
installShortcuts();