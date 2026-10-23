# Kniu Core 使用文档

`client/docs/` 存放项目核心库的前端使用说明。新增可供业务代码直接调用的 Core 模块时，应同时新增同名 `.md` 文档。

## 固定目录

- `client/config/`：项目配置
- `client/controller/`：页面控制器
- `client/core/`：可复用核心库
- `client/docs/`：核心库说明
- `client/views/`：页面模板
- `client/custom/`：唯一允许存放用户自定义组件的目录
- `client/core/kniu-ui/`：框架内置 UI 组件源码，由 Core 自动按需注册，不需要用户配置

可直接在页面模板使用 `kniu-badge`、`kniu-tag`、`kniu-status`、`kniu-empty`；Core 自动按标签按需注册。使用说明见 [KNIU-UI.md](./KNIU-UI.md)。
- `client/client.mjs`：唯一入口挂载脚本

请求和全局错误处理由 `kniu-request.mjs`、`kniu-error.mjs` 提供，业务 controller 不需要重复封装 fetch 或错误监听。

## 最小控制器

```js
import { setup } from '../core/kniu-mvvm.mjs';

export default setup(({ reactive }) => ({
  state: reactive({ 
    count: 0 
  }),
  add() { 
    this.state.count += 1; 
  }
}));
```
