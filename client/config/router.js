import { ROUTER } from '../core/kniueventer.mjs';
import { appLogger } from '../core/kniulogger.mjs';

// 需要登录鉴权的路由。
ROUTER.auth(function (router) {
  router.addRoute('seo', 'seoController');
  router.addRoute('nav', 'navController');
  router.addRoute('insights', 'insightsController');
});

// 无需登录鉴权的路由。
ROUTER.addRoute('login', 'loginController');

export { ROUTER };
appLogger.info(`KniuSystem router loaded with ${ROUTER.length} routes`, ROUTER.map(function (r) { return r.path; }));