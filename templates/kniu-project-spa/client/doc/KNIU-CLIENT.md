# Kniu Client 客户端使用文档

应用入口只负责创建客户端、安装插件和挂载：

```js
import { createClient, createRouterPlugin } from './core/Kniu-Client.mjs';

const client = createClient({ config, routes, views });
client.use(createRouterPlugin({ routes, views }));
client.mount('#client').catch((err) => {
  console.error('[kniu] 应用挂载失败：', err);
});
```

`createClient()` 创建应用实例，`use()` 安装核心或业务插件，`mount()` 启动插件并挂载到页面节点。模板示例的完整入口见 `client/client.js`。
