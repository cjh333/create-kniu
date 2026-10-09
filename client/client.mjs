import ROUTER from './config/router.js';
import CLIENT from './core/kniubase.mjs';
import IDENTITY from './core/kniuidentity.mjs';
import { authRedirect } from './core/kniurequest.mjs';
import UI from './core/kniuui/kniuui.mjs';

const client = CLIENT();
client.use(ROUTER);
client.useViews({
  'admin/main': 'admin/mainController',
  'admin/aside': 'admin/asideController',
  'admin/header': 'admin/headerController',
  'index/header': 'index/headerController',
  'index/footer': 'index/footerController'
});
UI.use({
  components: {
    btn: {
      size: 'default'
    },
    page: {
      layout: '条数,上一页,页码,下一页,总数'
    }
  },
  theme: {
    '--kniu-color-primary': '#409eff',
    '--kniu-color-primary-hover': '#79bbff',
    '--kniu-color-primary-light': '#ecf5ff',
    '--kniu-color-primary-lighter': '#c6e2ff',
    '--kniu-color-success': '#67c23a',
    '--kniu-color-success-hover': '#95d475',
    '--kniu-color-warning': '#e6a23c',
    '--kniu-color-warning-hover': '#eebe77',
    '--kniu-color-danger': '#f56c6c',
    '--kniu-color-danger-hover': '#f89898',
    '--kniu-color-info': '#909399',
    '--kniu-color-info-hover': '#b1b3b8',
    '--kniu-text-color': '#606266',
    '--kniu-text-color-disabled': '#a8abb2',
    '--kniu-border-color': '#dcdfe6',
    '--kniu-border-color-light': '#e4e7ed',
    '--kniu-fill-color': '#f5f7fa',
    '--kniu-fill-color-dark': '#e9e9eb',
    '--kniu-radius': '4px',
    '--kniu-control-height': 'max(28px,calc(40/var(--kniu_vw)))',
    '--kniu-control-height-small': 'max(28px,calc(28/var(--kniu_vw)))'
  }
});
authRedirect(function (route) {
  if (route === '/login' || route === '/register') {
    return;
  }
  const routeData = client.getRouteData();
  const payload = routeData && typeof routeData === 'object' ? { ...routeData } : {};
  payload.tab = IDENTITY.hasAccount() ? 'login' : 'register';
  payload.redirect = route;
  client.navigateTo('/login', payload);
});
client.mount('#client').catch(function (err) {
  console.error('[kniubase] 应用挂载失败：', err);
});