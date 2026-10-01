import { ROUTER } from '../core/kniueventer.mjs';
import { appLogger } from '../core/kniulogger.mjs';

ROUTER.add('login', 'admin/loginController');
ROUTER.add('register', 'admin/loginController');
ROUTER.add('/', 'index/homeController');
ROUTER.add('detail', 'index/detailController');
ROUTER.add('admin', 'admin/homeController');
ROUTER.add('home', 'admin/homeController');
ROUTER.add('seo', 'admin/seoController');
ROUTER.add('aboutedit', 'admin/abouteditController');
ROUTER.add('user', 'admin/userController');
ROUTER.add('daily', 'admin/dailyController');
ROUTER.add('article', 'admin/articleController');
ROUTER.add('comment', 'admin/commentController');
ROUTER.add('reply', 'admin/replyController');
ROUTER.add('about', 'index/aboutController');
ROUTER.add('profile', 'index/profileController');

export default ROUTER;
appLogger.info(`KniuSystem router loaded with ${ROUTER.length} routes`, ROUTER.map(function (r) { return r.path; }));