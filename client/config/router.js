import KniuEventer from '../core/kniueventer.mjs';
import KniuLogger from '../core/kniulogger.mjs';

const { ROUTER } = KniuEventer;
const { appLogger } = KniuLogger;

// 需要登录鉴权的路由。
ROUTER.auth(function (router) {
  router.addRoute('admin', 'admin/homeController');
  router.addRoute('home', 'admin/homeController');
  router.addRoute('seo', 'admin/seoController');
  router.addRoute('nav', 'admin/navController');
  router.addRoute('users', 'admin/usersController');
  router.addRoute('dailydetail', 'admin/dailydetailController');
  router.addRoute('articledetail', 'admin/articledetailController');
  router.addRoute('comment', 'admin/commentController');
  router.addRoute('reply', 'admin/replyController');
});

// 无需登录鉴权的路由。
ROUTER.addRoute('login', 'admin/loginController');
ROUTER.addRoute('/', 'index/homeController');
ROUTER.addRoute('about', 'index/aboutController');
ROUTER.addRoute('profile', 'index/profileController');
ROUTER.addRoute('detail', 'index/detailController');
// 前台登录/注册（同一页 tab 切换）。#/login 已被后台登录占用，故用 signin。
ROUTER.addRoute('signin', 'index/signinController');

export default ROUTER;
appLogger.info(`KniuSystem router loaded with ${ROUTER.length} routes`, ROUTER.map(function (r) { return r.path; }));
