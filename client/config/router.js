import KniuEventer from '../core/kniueventer.mjs';
import KniuLogger from '../core/kniulogger.mjs';

const { ROUTER } = KniuEventer;
const { appLogger } = KniuLogger;

// 需要登录鉴权的路由。
ROUTER.auth(function (router) {
  router.addRoute('admin', 'admin/homeController');
  router.addRoute('home', 'admin/homeController');
  router.addRoute('seo', 'admin/seoController');
  router.addRoute('aboutedit', 'admin/abouteditController');
  router.addRoute('user', 'admin/userController');
  router.addRoute('daily', 'admin/dailyController');
  router.addRoute('article', 'admin/articleController');
  router.addRoute('comment', 'admin/commentController');
  router.addRoute('reply', 'admin/replyController');
  router.addRoute('about', 'index/aboutController');
  router.addRoute('profile', 'index/profileController');
});

// 无需登录鉴权的路由。
ROUTER.addRoute('login', 'admin/loginController');
ROUTER.addRoute('register', 'admin/loginController');
ROUTER.addRoute('/', 'index/homeController');
ROUTER.addRoute('detail', 'index/detailController');

export default ROUTER;
appLogger.info(`KniuSystem router loaded with ${ROUTER.length} routes`, ROUTER.map(function (r) { return r.path; }));
