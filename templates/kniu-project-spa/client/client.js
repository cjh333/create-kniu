import { hideBootLoading } from './core/Kniu-BootLoading.mjs';
import { createClient, createRouterPlugin, createTemplatePlugin, UI, createControllerKit } from './core/Kniu-Kit.mjs';
import { raceTimeout } from './core/Kniu-Util.mjs';
import PROJECT_CONFIG from './project.config.js';

const SPECIAL_IMPORT_TIMEOUT = 10_000;
const FALLBACK_CONTRACTS = { auth: {}, roles: {}, uiText: {} };

let specialModule = null;
try {
  specialModule = await raceTimeout(import('/public/assets/Kniu-Special.js'), SPECIAL_IMPORT_TIMEOUT);
} catch (error) {
  console.warn('[kniu] Kniu-Special.js 导入失败，使用降级契约启动：', error);
}
const SPECIAL_CONTRACTS = specialModule?.default || FALLBACK_CONTRACTS;
const createAdminRoleGuardPlugin = specialModule?.createAdminRoleGuardPlugin || null;
const routes = PROJECT_CONFIG.routes || {};
const views = PROJECT_CONFIG.views || {};
const client = createClient({
  config: {
    ...PROJECT_CONFIG,
    contracts: SPECIAL_CONTRACTS
  },
  routes,
  views
});

client.use(createControllerKit({
  msg: (options) => UI.msg(options),
  confirm: (message) => UI.confirm(message)
}));
client.use(createTemplatePlugin({
  aliases: PROJECT_CONFIG.resolve?.alias,
  head: PROJECT_CONFIG.template?.head
}));
client.use(createRouterPlugin({
  routes,
  views,
  loading: PROJECT_CONFIG.loading
}));
if (createAdminRoleGuardPlugin) client.use(createAdminRoleGuardPlugin());

client.mount('#client').then(() => {
  hideBootLoading();
}).catch((err) => {
  hideBootLoading();
  console.error('[kniu] 应用挂载失败：', err);
  const root = document.querySelector('#client');
  if (root && !root.querySelector('[data-kniu-bootstrap-error]')) {
    const panel = document.createElement('pre');
    panel.dataset.kniuBootstrapError = 'true';
    panel.textContent = `Kniu 应用挂载失败：${err?.stack || err?.message || err}`;
    panel.style.cssText = 'margin:20px;padding:16px;color:#b42318;background:#fef3f2;white-space:pre-wrap;user-select:text;';
    root.appendChild(panel);
  }
});