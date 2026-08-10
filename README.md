# KniuSystem

一个零运行时依赖的单页面多应用框架示例，完全使用原生 JavaScript、Custom Elements、Shadow DOM、Location Hash 和 EventTarget 构建。

## 启动

```bash
npm run dev
```

启动后运行 `client/core/kniuserver.mjs`（开发服务器）：静态托管页面与公共资源，并按需生成模板清单；以 `/api` 开头的请求会代理到后端（开发环境默认 `http://localhost:9900`）。

访问 `http://localhost:6173`。

## 构建

```bash
npm run build
```

使用 esbuild 打包，产物输出到 `dist/` 目录。

## 架构

**核心模块（`client/core/` 下的命名导出模块）**：

| 模块 | 职责 |
| --- | --- |
| `kniubase.mjs` | `createApp()` 应用创建、自定义元素注册、路由渲染与前端路由守卫 |
| `kniumvvm.mjs` | 组合式 ViewModel：`setup`、`reactive`、`watch` 和组件生命周期 |
| `kniutemplate.mjs` | `reactive()` 响应式状态、变更观察和声明式模板绑定 |
| `kniueventer.mjs` | 事件总线、DOM 查询封装、模板加载和路由注册表 |
| `kniuauth.mjs` | `AUTH` 登录态响应式单例（登录、登出、401 复位） |
| `kniurequest.mjs` | `REQUEST` 请求封装、请求去重和 401 权威兜底 |
| `kniutil.mjs` | 全局响应式 UI 状态（加载遮罩、Toast） |
| `kniuserver.mjs` / `kniubuilder.mjs` | 开发服务器与生产构建 |

**装配与入口**：

- `client/index.mjs`：应用入口。`createApp()` → `app.use(ROUTER)` → `app.useViews({ main, aside, header })` → `app.mount('#app')`。
- `client/config/`：`builder.js` / `logger.js` / `router.js` / `server.js`，按环境取值后命名导出。路由统一在 `router.js` 配置：`ROUTER.auth(fn)` 内注册的路由需要登录态，`ROUTER.addRoute(path, controller)` 注册单个页面。
- `client/controller/`：按页面拆分的 ViewModel（`home` / `orders` / `inventory` / `insights` / `login` / `main` / `aside` / `header`）。
- `SERVER.VIEWS` 目录下的 HTML：每个页面 / 布局都是独立的 Shadow DOM 自定义元素（标签名 `app-<filename>`），由模板引擎在加载时挂载到对应元素。

**MVVM 分层**：

- Model：接口数据与 `AUTH`、`UTIL` 等领域 / 全局状态。
- ViewModel：Controller 使用 `defineComponent({ setup() {} })`；数据统一放在 `reactive()` 内，业务函数保持普通闭包，通过 `toRefs()` 按需暴露；生命周期使用 `onMounted()` / `onUnmounted()`。
- View（`.html`）：只保留 Shadow DOM 结构、样式与 `kniu:*` 声明式绑定，不直接操作业务状态。
- 子应用样式写入自己的 Shadow Root，不泄漏到主应用或其他子应用。

## 模块导出规范（重要）

全项目统一使用**命名导出**，禁止 `export default`：

- 对外暴露 API 一律使用命名导出（例如 `createApp`、`defineComponent`、`reactive`、`ROUTER`、`AUTH`、`REQUEST`）。
- 消费方一律具名导入 `import { X } from '...'`，不要用 `import X from`（会因找不到具名导出而报 `does not provide an export named`）。
- 核心模块为 IIFE 单例：内部状态 / 辅助函数闭包私有，末尾 `export const X = Var.X` 原样重导出。

## 鉴权与路由守卫

采用**前端即时拦截 + 后端 401 权威兜底**的双保险：

- **前端路由守卫**（位于 `kniubase.mjs` 的 `_renderRoute` 顶部）：`router.js` 中写在 `ROUTER.auth(fn)` 回调里的路由会被打上 `authRequired=true`；未登录访问这类路由时直接 `location.hash = '/login'` 并停止渲染，内页不会打开。`/login` 为公开路由。
- **登录态真相 = `AUTH`**（`kniuauth.mjs` 的响应式单例）：`loginController` 登录成功后调 `AUTH.setUser(...)`；应用启动 `mount()` 时调 `AUTH.restoreSession()` 凭 `sessionStorage.kniu_authed` 乐观恢复，避免已登录用户刷新被误踢回登录页。
- **后端 401 兜底**：`kniurequest.mjs` 收到任意接口 401 时调 `AUTH.markLoggedOut()` 清前端态并跳 `/login`。
- **退出**：`asideController` 的 `logout` → `AUTH.logout()`（调后端 `POST /api/logout` 销毁会话 + 重置响应式状态）→ `sessionStorage.clear()` → `navigateTo('/login')`。退出后任何内页地址都会被守卫弹回登录页。

## 构建产物

构建使用 esbuild 打包，产物结构如下（文件名带内容哈希）：

- `dist/index.html`：入口文件，自动注入脚本引用
- `dist/views/client.<hash>.js`：打包后的客户端代码（含 `kniubase` / `kniutemplate` / `kniueventer` 等核心模块）
- `dist/views/templates.<hash>.js`：收集所有 HTML 模板生成的模板清单（`globalThis.__VIEW_TEMPLATES__`）
- `dist/public/`：静态资源（CSS、图片等）

新增、删除或重命名应用页面后，只需同步修改 `client/config/router.js`。

## 开发与生产

- `npm run dev`：启动开发服务器（`client/core/kniuserver.mjs`），动态生成模板清单
- `npm run build`：构建生产版本（`client/core/kniubuilder.mjs`），使用 esbuild 打包并优化

每个 Controller 通过 `defineComponent()` 暴露标准 ViewModel，框架负责挂载和卸载。子应用样式写入自己的 Shadow Root，不会泄漏到主应用或其他子应用。
