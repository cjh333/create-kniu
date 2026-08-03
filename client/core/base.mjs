import { ROUTER } from '../config/router.js';
import { loadHtmlTemplate } from './eventer.mjs';
import { mountWorkspace as mountWorkspaceCore } from './workspace.mjs';
import { EventBus, MicroAppRuntime } from './runtime.mjs';
export { EventBus, MicroAppRuntime, ShadowAppHost } from './runtime.mjs';

export const html = String.raw;

// 递归扫描目录收集。
export async function collectTemplates(directory = 'views') {
  const { readdir, readFile } = await import('node:fs/promises');
  const { join, relative } = await import('node:path');
  const templates = {};
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        Object.assign(templates, await collectTemplates(path));
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        const templatePath = `/${relative('.', path).replaceAll('\\', '/')}`;
        templates[templatePath] = await readFile(path, 'utf8');
      }
    }),
  );
  return templates;
}

// 订阅 eventTo 的 toast 事件，渲染提示并自动隐藏；返回取消订阅函数。
export function useToastNotifications(eventTo, { target, duration = 2600, prefix = '✓ ' } = {}) {
  let timer;
  const off = eventTo.on('toast', (message) => {
    target.textContent = `${prefix}${message}`;
    target.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => target.classList.remove('show'), duration);
  });
  return () => {
    clearTimeout(timer);
    off();
  };
}

export function createAppRuntime({ outlet, eventTo, routes, onRouteChange } = {}) {
  const defaultRoute =
    routes.find((route) => route.path === '/')?.path ?? routes[0]?.path;
  if (!defaultRoute) throw new Error('routes must contain at least one route');
  const runtime = new MicroAppRuntime({ outlet, eventTo, onChange: onRouteChange });
  runtime.registerRoutes(routes).startRouter(defaultRoute);
  return { runtime, defaultRoute };
}

if (typeof document !== 'undefined') {
  const app = document.querySelector('#app');
  const rootInclude = app?.querySelector(':scope > include[src]');
  const templateUrl = rootInclude?.getAttribute('src');
  if (!templateUrl) throw new Error('App mount point must contain a root <include src="...">');

  await loadHtmlTemplate(templateUrl, app, undefined, {
    strictSelectors: true,
    eventTo: new EventBus(),
    ROUTER,
    useToastNotifications,
    createAppRuntime,
    mountWorkspace(options) {
      return mountWorkspaceCore(this, options);
    },
  }, (kniusystem, root) => kniusystem.mountWorkspace());
}
