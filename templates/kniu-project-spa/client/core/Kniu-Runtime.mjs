const DOCUMENT_STYLE_ADAPTER_KEY = '__KNIU_DOCUMENT_STYLE_ADAPTER__';
const THEME_STYLE_SHEET_PROVIDER_KEY = '__KNIU_THEME_STYLE_SHEET_PROVIDER__';
const COMPONENT_MODULE_LOADER_KEY = '__KNIU_COMPONENT_MODULE_LOADER__';

function readProvider(key) {
  const value = globalThis[key];
  return typeof value === 'function' ? value : null;
}

function writeProvider(key, fn) {
  globalThis[key] = typeof fn === 'function' ? fn : null;
}

export function setDocumentStyleAdapter(fn) { writeProvider(DOCUMENT_STYLE_ADAPTER_KEY, fn); }

export function adoptDocumentStyle(...args) {
  const adapter = readProvider(DOCUMENT_STYLE_ADAPTER_KEY);
  return adapter ? adapter(...args) : null;
}

export function setThemeStyleSheetProvider(fn) { writeProvider(THEME_STYLE_SHEET_PROVIDER_KEY, fn); }

export function getThemeStyleSheet() {
  const provider = readProvider(THEME_STYLE_SHEET_PROVIDER_KEY);
  return provider ? provider() : null;
}

export function setComponentModuleLoader(fn) { writeProvider(COMPONENT_MODULE_LOADER_KEY, fn); }

export function loadComponentModule() {
  const loader = readProvider(COMPONENT_MODULE_LOADER_KEY);
  if (!loader) throw new Error('[kniu] 组件模块加载器未注入：请通过 createClient 装配或 setComponentModuleLoader 注册。');
  return loader();
}

export function hasComponentModuleLoader() { return readProvider(COMPONENT_MODULE_LOADER_KEY) !== null; }

const runtimeNodes = new Map();

export function trackRuntimeNode(node, owner = 'client') {
  if (!node) return node;
  if (!runtimeNodes.has(owner)) runtimeNodes.set(owner, []);
  runtimeNodes.get(owner).push(node);
  return node;
}

export function releaseRuntimeNodes(owner = 'client') {
  const nodes = runtimeNodes.get(owner) || [];
  nodes.forEach((node) => node?.remove?.());
  runtimeNodes.delete(owner);
  return nodes.length;
}

export function trackedRuntimeNodeCount(owner = 'client') {
  return (runtimeNodes.get(owner) || []).length;
}