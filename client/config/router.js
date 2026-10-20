import { ROUTER } from '../core/kniueventer.mjs';
import { appLogger } from '../core/kniulogger.mjs';

ROUTER.add('/', 'index/homeController');
ROUTER.add('login', 'admin/loginController');
ROUTER.add('register', 'admin/registerController');
ROUTER.add('forgot', 'admin/forgotController');
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
ROUTER.add('feedback', 'admin/feedbackController');
ROUTER.add('dbconnect', 'admin/dbConnectController');
ROUTER.add('database', 'admin/databaseController');
ROUTER.add('databasetables', 'admin/databaseTablesController');
ROUTER.add('databasetable', 'admin/databaseTableController');
ROUTER.add('about', 'index/aboutController');
ROUTER.add('profile', 'index/profileController');

export default ROUTER;
appLogger.info(`KniuSystem router loaded with ${ROUTER.length} routes`, ROUTER.map(function (r) { return r.path; }));