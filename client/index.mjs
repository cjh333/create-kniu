import { ROUTER } from './config/router.js';
import { createApp } from './core/kniubase.mjs';

const app = createApp();
app.use(ROUTER);
app.useViews({
  main: 'mainController',
  aside: 'asideController',
  header: 'headerController'
});
app.mount('#app').catch(function (err) {
  console.error('[kniubase] 应用挂载失败：', err);
});
