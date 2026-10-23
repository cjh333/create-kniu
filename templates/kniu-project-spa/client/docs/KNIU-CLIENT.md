# Kniu Client 客户端使用文档

应用入口只负责创建客户端、安装插件和挂载：

```js
import { CLIENT, ROUTER } from './core/kniu-client.mjs';

const client = CLIENT();
client.use(ROUTER);
client.mount('#client').catch((err) => {
  console.error('[kniu] 应用挂载失败：', err);
});
```

`CLIENT()` 创建应用实例，`use()` 安装核心或业务插件，`mount()` 启动插件并挂载到页面节点。
