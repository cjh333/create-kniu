import ROUTER from './config/router.js';
import CREATEAPP from './core/kniubase.mjs';

const app = CREATEAPP();
app.use(ROUTER);
app.useViews({
  'admin/main': 'admin/mainController',
  'admin/aside': 'admin/asideController',
  'admin/header': 'admin/headerController',
  'index/header': 'index/headerController',
  'index/footer': 'index/footerController'
});
app.mount('#app')
  .catch(function (err) {
    console.error('[kniubase] 应用挂载失败：', err);
  });