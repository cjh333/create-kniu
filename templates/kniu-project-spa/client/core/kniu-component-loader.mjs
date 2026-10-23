let componentsPromise;
const componentBundles = new Map();
let componentManifestPromise;

function componentTags(root) {
  return [...root.querySelectorAll('*')]
    .map((element) => element.localName)
    .filter((tag) => tag.startsWith('kniu-'));
}

function loadScript(url) {
  if (componentBundles.has(url)) return componentBundles.get(url);
  const pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve(globalThis.__KNIU_COMPONENTS__);
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
  componentManifestPromise = fetch(url, { credentials: 'same-origin' }).then((response) => {
    if (!response.ok) throw new Error('[kniu] 无法读取组件 manifest。');
    return response.json();
  });
  return componentManifestPromise;
}

export function loadComponents(root = document) {
  const manifestUrl = document.querySelector('meta[name="kniu-component-manifest"]')?.content;
  if (!manifestUrl) {
    if (!componentsPromise) componentsPromise = import('./kniu-components.mjs');
    return componentsPromise.then((module) => module.load(root));
  }
  return loadProductionManifest().then(async (manifest) => {
    const urls = new Set(componentTags(root).flatMap((tag) => manifest.tags?.[tag] || []));
    const modules = await Promise.all([...urls].map(loadScript));
    await Promise.all(modules.map((module) => module?.load(root)));
  });
}

export default loadComponents;