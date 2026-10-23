import { CLIENT, ROUTER, TEMPLATE } from './core/kniu-client.mjs';

const client = CLIENT();
client.use(TEMPLATE);
client.use(ROUTER);
client.mount('#client').catch((err) => {
  console.error('[kniu] 应用挂载失败：', err);
});