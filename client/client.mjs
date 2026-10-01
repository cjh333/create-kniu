import ROUTER from './config/router.js';
import CREATEAPP from './core/kniubase.mjs';
import IDENTITY from './core/kniuidentity.mjs';
import { useAuthRedirect } from './core/kniurequest.mjs';
import UI from './core/kniuui.js';

const app = CREATEAPP();
app.use(ROUTER);
app.useViews({
  'admin/main': 'admin/mainController',
  'admin/aside': 'admin/asideController',
  'admin/header': 'admin/headerController',
  'index/header': 'index/headerController',
  'index/footer': 'index/footerController'
});
UI.use({
  components: {
    btn: { size: 'small' },
    page: { layout: '总数,上一页,页码,下一页,条数' }
  },
  theme: {
    '--kniu-color-primary': '#409eff',
    '--kniu-border-color': '#dcdfe6',
    '--kniu-radius': '4px',
    '--kniu-control-height': 'max(28px,calc(32 / var(--kniu_vw)))'
  }
});
useAuthRedirect(function () {
  const hashPath = String(globalThis.location?.hash || '').replace(/^#/, '');
  const routePath = hashPath.split('?')[0].split('#')[0] || '/';
  if (routePath === '/login' || routePath === '/register') return;
  const routeData = app.getRouteData();
  const payload = routeData && typeof routeData === 'object' ? { ...routeData } : {};
  payload.tab = IDENTITY.hasAccount() ? 'login' : 'register';
  payload.redirect = routePath;
  app.navigateTo('/login', payload);
});
app.mount('#app').catch(function (err) {
  console.error('[kniubase] 应用挂载失败：', err);
});