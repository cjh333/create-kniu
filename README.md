# KniuSystem

一个零运行时依赖的单页面多应用框架示例，完全使用原生 JavaScript、
Custom Elements、Shadow DOM、Location Hash 和 EventTarget 构建。

## 启动

```bash
npm run dev
```

访问 `http://localhost:6173`。

## 构建

```bash
npm run build
```

构建产物输出到 `dist` 目录。

## 架构

**核心模块**：
- `client/core/base.mjs`：应用启动和公共服务装配
- `client/core/runtime.mjs`：路由运行时、Shadow Root 与生命周期管理
- `client/core/eventer.mjs`：HTML 模板加载、Controller 挂载和路由注册
- `client/core/kniutemplate.mjs`：响应式数据绑定和模版引擎
- `client/config/router.js`：统一管理所有应用路由、导航信息和模块绑定

**MVC 分层**：
- `client/model/`：业务数据、派生统计与领域判断，不依赖 DOM
- `client/controller/`：创建响应式状态、处理用户动作并协调导航和消息
- `client/core/workspace.mjs`：公共外壳状态、导航、路由同步、快捷键、Toast 与销毁逻辑
- `client/controller/`：按应用拆分的页面交互控制器
- `public/static/css/webs.css`：只作用于主应用外壳的全局样式
- `views/*.html`：只保留每个应用的 Shadow DOM 结构、样式和声明式绑定
- `views/common/header.html`：公共顶部栏模板
- `views/common/main.html`：侧边栏、工作区和挂载点等声明式公共布局

## 构建产物

构建使用 esbuild 打包，产物结构如下：
- `dist/index.html`：入口文件，自动注入脚本引用
- `dist/views/client.js`：打包后的客户端代码（包含 base.mjs、kniutemplate.mjs 等）
- `dist/views/templates.js`：收集所有 HTML 模板生成的模版清单
- `dist/public/`：静态资源（CSS、图片等）

新增、删除或重命名应用页面后，只需同步修改 `router.js`。

## 开发与生产

- `npm run dev`：启动开发服务器（`client/core/server.mjs`），动态生成模版清单
- `npm run build`：构建生产版本，使用 esbuild 打包并优化

每个 Controller 暴露 `mount(root, kniusystem)`，并可返回清理函数。子应用样式写入
自己的 Shadow Root，不会泄漏到主应用或其他子应用。
