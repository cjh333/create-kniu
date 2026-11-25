import { scopeGet } from './Kniu-Scope.mjs';
import { loadComponentModule } from './Kniu-Runtime.mjs';
import { kniuWarn, KNDEBUG } from './Kniu-Debug.mjs';

let componentsPromise;
const componentBundles = new Map();
let componentManifestPromise;
let registryReady = false;
let loadedModules = [];

function loadScript(url) {
  if (componentBundles.has(url)) return componentBundles.get(url);
  const pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => {
      const bundles = scopeGet('__KNIU_COMPONENT_BUNDLES__');
      const self = script.src || url;
      if (bundles && bundles[self]) { resolve(bundles[self]); return; }
      resolve(scopeGet('__KNIU_COMPONENTS__'));
    };
    script.onerror = () => reject(new Error(`[kniu] 组件 bundle 加载失败：${url}`));
    document.head.append(script);
  });
  componentBundles.set(url, pending);
  return pending;
}

function loadProductionManifest() {
  if (componentManifestPromise) return componentManifestPromise;
  const url = document.querySelector('meta[name="kniu-component-manifest"]')?.content;
  if (!url) return Promise.reject(new Error('[kniu] 组件 manifest 地址未配置。'));
  componentManifestPromise = fetch(url, { credentials: 'same-origin' })
    .then((response) => {
      if (!response.ok) {
        kniuWarn(KNDEBUG.COMPONENT, `[kniu] 组件 manifest 读取失败（HTTP ${response.status}）：${url}；请确认 dist 已部署且 /public/assets 路径可达。`);
        throw new Error(`[kniu] 无法读取组件 manifest（HTTP ${response.status}）：${url}`);
      }
      return response.json();
    })
    .catch((error) => {
      kniuWarn(KNDEBUG.COMPONENT, `[kniu] 组件 manifest 加载失败：${url}`, error);
      throw error;
    });
  return componentManifestPromise;
}

async function ensureRegistry(manifest, root) {
  if (registryReady) return;
  const urls = new Set(Object.values(manifest.tags || {}).flat());
  const modules = await Promise.all([...urls].map(loadScript));
  await Promise.all(modules.map((module) => (
    typeof module?.preload === 'function' ? module.preload() : module?.load(root)
  )));
  loadedModules = modules;
  registryReady = true;
}

export function loadComponents(root = document) {
  const manifestUrl = document.querySelector('meta[name="kniu-component-manifest"]')?.content;
  if (!manifestUrl) {
    if (!componentsPromise) componentsPromise = loadComponentModule();
    return componentsPromise.then((module) => module.load(root));
  }
  return loadProductionManifest().then(async (manifest) => {
    if (!registryReady) {
      await ensureRegistry(manifest, root);
      return;
    }
    await Promise.all(loadedModules.map((module) => module?.loadCustomComponents?.(root)));
  });
}

export function preloadComponents() {
  const manifestUrl = document.querySelector('meta[name="kniu-component-manifest"]')?.content;
  if (manifestUrl) {
    return loadProductionManifest()
      .then((manifest) => Promise.all(
        [...new Set(Object.values(manifest.tags || {}).flat())].map(loadScript)
      ))
      .catch((error) => kniuWarn(KNDEBUG.COMPONENT, '[kniu] 组件预热失败（按需加载不受影响）：', error));
  }
  if (!componentsPromise) componentsPromise = loadComponentModule();
  return componentsPromise
    .then((module) => (typeof module.preload === 'function' ? module.preload() : undefined))
    .catch((error) => kniuWarn(KNDEBUG.COMPONENT, '[kniu] 组件预热失败（按需加载不受影响）：', error));
}

export default loadComponents;