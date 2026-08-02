import { ROUTER } from '../core/eventer.mjs';
import { logger } from '../core/logger.mjs';
import { homeController } from '../controller/homeController.js';
import { ordersController } from '../controller/ordersController.js';
import { inventoryController } from '../controller/inventoryController.js';
import { insightsController } from '../controller/insightsController.js';

ROUTER
  .addRoute('/', '/views/home.html', homeController)
  .addRoute('/overview', '/views/home.html', homeController)
  .addRoute('/orders', '/views/orders.html', ordersController)
  .addRoute('/inventory', '/views/inventory.html', inventoryController)
  .addRoute('/insights', '/views/insights.html', insightsController);

export { ROUTER };
logger.info(`KniuSystem router loaded with ${ROUTER.length} routes`, ROUTER.map((r) => r.path));
