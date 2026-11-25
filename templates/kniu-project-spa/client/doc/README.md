# Kniu Core 使用文档

`client/doc/` 存放项目核心库的前端使用说明。新增可供业务代码直接调用的 Core 模块时，应同时新增同名 `.md` 文档。

## 固定目录

- `client/config/`：项目配置（路由与视图映射）；框架配置位于 `client/client.config.js`，项目合并入口为 `client/project.config.js`
- `client/controller/`：页面控制器
- `client/core/`：可复用核心库（`Kniu-*.mjs`）
- `client/doc/`：核心库说明
- `client/views/`：页面模板
- `client/custom/`：唯一允许存放用户自定义组件的目录
- `client/core/Kniu-Ui/`：框架内置 UI 组件源码，由 Core 自动按需注册，不需要用户配置
- `client/client.js`：唯一入口挂载脚本

可直接在页面模板使用 `Kniu-Badge`、`Kniu-Tag`、`Kniu-Status`、`Kniu-Empty`；Core 自动按标签按需注册。使用说明见 [KNIU-UI.md](./KNIU-UI.md)。

请求和全局错误处理由 `Kniu-Request.mjs`、`Kniu-Error.mjs` 提供，业务 controller 不需要重复封装 fetch 或错误监听。

## 最小控制器

```js
import { setup } from '../core/Kniu-MVVM.mjs';

export default setup(({ reactive }) => {
  const state = reactive({ count: 0 });
  return {
    state,
    add() { state.count += 1; }
  };
});
```
