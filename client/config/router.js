import KniuEventer from '../core/kniueventer.mjs';
import KniuLogger from '../core/kniulogger.mjs';

const { ROUTER } = KniuEventer;
const { appLogger } = KniuLogger;

// 需要登录鉴权的路由。
ROUTER.auth(function (router) {
  router.addRoute('seo', 'seoController');
  router.addRoute('nav', 'navController');
  router.addRoute('dailydetail', 'dailydetailController');
  router.addRoute('articledetail', 'articledetailController');
});

// 无需登录鉴权的路由。
ROUTER.addRoute('login', 'loginController');

export default ROUTER;
appLogger.info(`KniuSystem router loaded with ${ROUTER.length} routes`, ROUTER.map(function (r) { return r.path; }));