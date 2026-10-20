import ROUTER from './config/router.js';
import REQUEST_CONFIG from './config/request.js';
import UI_CONFIG from './config/ui.js';
import VIEWER from './config/viewer.js';
import CLIENT from './core/kniubase.mjs';
import { authRedirect } from './core/kniurequest.mjs';
import UI from './core/kniuui/kniuui.mjs';
import { setAuthRoutes } from './core/kniulastroute.mjs';

// 注入本项目鉴权中转页清单：直接复用 REDIRECT 的 route（单一真相源，避免重复配置）。
// 核心库 kniulastroute 保持项目无关，具体路由由使用方按本项目配置提供。
setAuthRoutes((REQUEST_CONFIG.REDIRECT || []).map(function (item) { return item && item.route; }).filter(Boolean));

const client = CLIENT();
client.use(ROUTER);
client.useViews(VIEWER);
UI.use(UI_CONFIG);
authRedirect(client, REQUEST_CONFIG.REDIRECT);
client.mount('#client').catch(function (err) {
  console.error('[kniubase] 应用挂载失败：', err);
});