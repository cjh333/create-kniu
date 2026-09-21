import EVENTER from '../core/kniueventer.mjs';
import LOGGER from '../core/kniulogger.mjs';

const { ROUTER } = EVENTER;
const { appLogger } = LOGGER;

// 需要登录鉴权的路由。
ROUTER.auth(function (router) {
  router.add('admin', 'admin/homeController');
  router.add('home', 'admin/homeController');
  router.add('seo', 'admin/seoController');
  router.add('aboutedit', 'admin/abouteditController');
  router.add('user', 'admin/userController');
  router.add('daily', 'admin/dailyController');
  router.add('article', 'admin/articleController');
  router.add('comment', 'admin/commentController');
  router.add('reply', 'admin/replyController');
  router.add('about', 'index/aboutController');
  router.add('profile', 'index/profileController');
});

// 无需登录鉴权的路由。
ROUTER.add('login', 'admin/loginController');
ROUTER.add('register', 'admin/loginController');
ROUTER.add('/', 'index/homeController');
ROUTER.add('detail', 'index/detailController');

export default ROUTER;
appLogger.info(`KniuSystem router loaded with ${ROUTER.length} routes`, ROUTER.map(function (r) { return r.path; }));