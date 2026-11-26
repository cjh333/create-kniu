import FRAMEWORK_CONFIG from './client.config.js';
import { deepMerge } from './core/Kniu-Merge.mjs';
import { routes as PROJECT_ROUTES } from './config/router.js';
import PROJECT_BASES from './config/server.js';
import PROJECT_VIEWS from './config/viewer.js';
import { AUTH_CONFIG as PROJECT_AUTH } from './config/auth.js';

const PROJECT_SETTINGS = {
  routes: PROJECT_ROUTES,
  views: PROJECT_VIEWS,
  ...PROJECT_BASES,
  auth: PROJECT_AUTH
};
const PROJECT_CONFIG = deepMerge(FRAMEWORK_CONFIG, PROJECT_SETTINGS);

export default PROJECT_CONFIG;