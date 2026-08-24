# KniuSystem 技术说明

KniuSystem 是一个前后端分离的单页面管理系统。前端使用原生 JavaScript、Custom Elements、Shadow DOM、Location Hash 和 EventTarget 构建，不依赖前端运行时框架；后端使用 PHP、Composer 与轻量路由/控制器结构提供 JSON API。

## 技术栈

| 层级 | 技术与职责 |
| --- | --- |
| 前端运行时 | 原生 ES Modules、Custom Elements、Shadow DOM、Hash Router、响应式模板绑定 |
| 前端构建 | Node.js、esbuild；打包脚本、模板和带内容哈希的静态资源 |
| 开发服务 | Node.js HTTP Server；托管前端资源、生成模板清单、代理 `/api` 请求 |
| 后端接口 | PHP、Composer 自动加载、控制器路由、Session 鉴权、JSON 响应 |
| 数据访问 | `api/core/Db.php` 与 `api/config/database.php` |

## 项目结构

```text
KniuSystem/
├─ client/
│  ├─ client.mjs             # 浏览器应用入口
│  ├─ config/                # 构建、日志、路由、服务配置
│  ├─ controller/            # 页面与公共布局的 ViewModel
│  ├─ core/                  # SPA、MVVM、模板、请求、鉴权等核心模块
│  └─ views/
│     ├─ index.html          # HTML 外壳
│     └─ admin/              # 页面模板与 common/ 公共布局模板
├─ api/
│  ├─ index.php              # PHP API 入口
│  ├─ config/                # 路由、数据库、鉴权、日志等配置
│  ├─ core/                  # Router、Controller、Db 等基础设施
│  └─ app/                   # index/admin 业务控制器
├─ public/                   # CSS、图片、字体和 Kniu 插件资源
├─ dist/                     # 生产构建产物
└─ package.json              # 前端开发与构建命令
```

## 前端架构

### 启动与装配

浏览器加载 `client/views/index.html`，其中的模块脚本指向 `client/client.mjs`。入口执行顺序为：

1. 从 `client/config/router.js` 加载路由表。
2. 调用 `createApp()` 创建应用实例和事件总线。
3. 通过 `app.use(ROUTER)` 注入页面路由。
4. 通过 `app.useViews({ 'admin/main', 'index/header', ... })` 按目录注入公共布局 Controller。
5. 调用 `app.mount('#app')` 恢复会话、注册组件并渲染当前 Hash 路由。

### 视图、路由与组件

- `client/views/index/*.html` 是公开前台页面，`client/views/admin/*.html` 是后台页面；页面会映射为包含目录的唯一组件标识，避免前后台同名模板相互覆盖。
- `client/views/admin/common/*.html` 与 `client/views/index/common/*.html` 是各自区域的公共布局组件，不直接进入页面路由。
- `SERVER.HOME` 当前为 `index/index`，因此 `/` 默认渲染前台 `index.html`。
- 路由使用 Location Hash，例如 `#/login`、`#/seo`、`#/nav`、`#/articledetail`。
- 页面模板在独立 Shadow Root 内渲染，样式与 DOM 查询默认限制在组件作用域内。

当前路由配置如下：

| 路径 | Controller | 鉴权 |
| --- | --- | --- |
| `/` | `index/homeController` | 公开 |
| `/about` | `index/aboutController` | 公开 |
| `/detail` | `index/detailController` | 公开；文章 ID 通过路由状态传递，不显示在地址栏 |
| `/login` | `admin/loginController` | 公开 |
| `/admin` | `admin/homeController` | 需要登录；后台入口 |
| `/home` | `admin/homeController` | 需要登录 |
| `/seo` | `admin/seoController` | 需要登录 |
| `/nav` | `admin/navController` | 需要登录 |
| `/dailydetail` | `admin/dailydetailController` | 需要登录 |
| `/articledetail` | `admin/articledetailController` | 需要登录 |

路由的 Controller 必须填写包含目录的完整相对路径；公开前台使用 `index/`，后台使用 `admin/`。`admin/mainController`、`admin/asideController` 和 `admin/headerController` 由公共布局装配；模板目录中存在但未注册到路由表的页面会被收集为组件，但不会成为显式业务路由。

### MVVM 分层

- Model：API 数据以及 `AUTH`、`UTIL` 等全局状态。
- ViewModel：`client/controller/` 中的 Controller 使用 `controller(setupFn)`；状态由 `reactive()` 创建，setup 直接返回模板所需状态与方法。
- View：HTML 模板保留结构、样式与 `kniu:*` 声明式绑定。
- 生命周期：`onMounted()`、`onUnmounted()` 和 `onScopeDispose()` 统一管理事件、定时器和清理函数。
- 动态加载：路由与公共布局 Controller 由 `loadController()` 按明确的目录路径动态导入，不猜测同名 Controller 所在目录。

控制器直接返回需要给模板使用的状态和方法：

```js
const { controller, reactive, onMounted } = KniuMvvm;

export default controller(() => {
  const state = reactive({ loading: false });
  function load() { state.loading = true; }
  onMounted(load);
  return { state, load };
});
```

MVVM 提供 `ref()`、`computed()`、getter/多来源 `watch()` 和 `watchEffect()`；可复用的有状态逻辑统一以 `useXxx()` composable 命名。

### 核心模块

| 模块 | 职责 |
| --- | --- |
| `kniubase.mjs` | 创建应用、注册 Shadow DOM 组件、恢复会话、渲染路由与执行路由守卫 |
| `kniumvvm.mjs` | Controller 动态加载、组件定义、ViewModel 创建、生命周期与 `watch()` |
| `kniutemplate.mjs` | 响应式状态、依赖观察、`kniu:*` 声明式模板绑定与清理 |
| `kniuscheduler.mjs` | 更新任务去重、微任务批处理与 `nextTick()` 刷新边界 |
| `kniueventer.mjs` | 事件总线、作用域 DOM 工具、模板加载、模板嵌入和路由注册表 |
| `kniuauth.mjs` | `AUTH` 登录状态、用户信息、会话恢复、退出和失效复位 |
| `kniurequest.mjs` | `/api` 请求封装、响应归一化、并发去重和 401 处理 |
| `kniuui.js` | 系统 UI 组件、消息提示与路径别名替换 |
| `kniulogger.mjs` | 按环境配置的前端/构建日志 |
| `kniuserver.mjs` | 开发静态服务、模板清单生成和 API 反向代理 |
| `kniubuilder.mjs` | 生产打包、模板内联、内容哈希、资源引用改写和产物输出 |

### 模板运行机制

开发环境由服务器扫描 `SERVER.VIEWS`，将除 `index.html` 外的模板写入 `globalThis.__VIEW_TEMPLATES__`。生产构建执行相同的模板收集逻辑并输出独立的 `templates.<hash>.js`。组件挂载时优先从模板清单读取，随后解析路径别名和模板嵌入，执行模板脚本、Controller 绑定及清理注册。

### 鉴权与请求链路

1. `AUTH.restoreSession()` 根据 `sessionStorage.kniu_authed` 和 `kniu_user` 乐观恢复前端状态；缺少用户信息时请求 `/api/system`。
2. `ROUTER.auth()` 内注册的路由标记为 `authRequired`，未登录访问时跳转 `#/login`。
3. `REQUEST` 自动为相对接口添加 `/api` 前缀，默认携带 Cookie，并将响应归一为 `{ status, msg, data, httpStatus, request }`。
4. 任意接口返回 HTTP 401 时，`AUTH.markLoggedOut()` 清理本地登录态并跳转登录页。
5. 退出登录调用 `POST /api/logout`，销毁后端 Session 并复位前端状态。

前端守卫只负责即时体验，后端 Session 与接口鉴权仍是最终权限边界。

## 后端架构

`api/index.php` 是统一入口：初始化 Composer 自动加载和 Session，读取应用/日志配置，处理 CORS，解析请求 URI，随后交给 `Core\Router` 分发。控制器按应用划分：

- `api/app/index/Controllers/`：公开内容接口。
- `api/app/admin/Controllers/`：登录、系统信息、SEO、导航、每日内容、文章、角色和缓存管理。
- `api/core/AdminBaseController.php`：后台控制器的公共鉴权基础。
- `api/core/Controller.php`：请求参数和 JSON 响应等控制器基础能力。

接口统一在 `api/config/router.php` 注册，当前均使用 POST，包括：

- 公共内容：`/getDaily`、`/getArticle`、`/getInfo`、`/getDetail`
- 会话与系统：`/logup`、`/logout`、`/captcha`、`/admin`、`/system`
- 后台业务：SEO、导航、每日内容、文章、角色的增删改查，以及 `/clearCache`

## 配置说明

| 配置文件 | 关键内容 |
| --- | --- |
| `client/config/env.js` | 统一导出当前运行环境 `PROCESS_ENV` |
| `client/config/server.js` | 环境、时区、主机、端口、首页、视图目录、路径别名与 API 代理 |
| `client/config/router.js` | 页面路由、Controller 映射与鉴权分组 |
| `client/config/builder.js` | 输出目录、资源访问前缀、产物子目录和待复制资源 |
| `client/config/logger.js` | 日志级别与输出策略 |
| `api/config/router.php` | 后端接口与控制器方法映射 |
| `api/config/database.php` | 数据库连接 |
| `api/config/auth.php`、`role.php` | 会话鉴权与角色权限 |
| `api/config/log.php`、`upload.php` | 日志与上传配置 |

开发环境默认前端地址为 `http://localhost:6173`，`/api` 请求代理到 `http://localhost:9900`。生产环境的 API 代理目标为空，前后端应由部署层配置为同源或配置反向代理。

## 本地开发

### 后端

```bash
cd api
composer install
php -S localhost:9900 -t .
```

### 前端

在项目根目录执行：

```bash
npm install
npm run dev
```

然后访问 `http://localhost:6173`。Windows 下需要结束遗留 Node 进程时可执行 `npm run kill`。

## 生产构建

```bash
npm run build
```

`build` 脚本已固定为 `cross-env PROCESS_ENV=production node client/core/kniubuilder.mjs`（生产环境开启模板内联、压缩与内容哈希）。若需显式控制，也可手动运行：

```bash
rm -rf dist && PROCESS_ENV=production node client/core/kniubuilder.mjs
```

> 环境约定：`client/config/env.js` 默认 `development`；`npm run dev` 通过 `--env-file=.env`（内含 `PROCESS_ENV=development`）注入开发环境；只有显式 `PROCESS_ENV=production`（或 `npm run build`）才产出生产产物。

构建器会清空并重新生成 `dist/`：

```text
dist/
├─ index.html
├─ views/
│  ├─ client.<hash>.js
│  └─ templates.<hash>.js
└─ public/
   └─ ...带内容哈希的 CSS、JavaScript、图片和字体
```

- `index.html` 会注入模板清单和客户端模块脚本。
- 客户端代码由 `client/client.mjs` 作为生产构建入口。
- 模板和 CSS 内的资源路径会改写为哈希文件路径。
- `BUILDER.PUBLIC_PATH` 可设置根路径或子目录部署前缀；空字符串表示相对产物路径。

## 开发约定

- 单能力核心模块使用默认导出；`kniuutil.mjs` 这类纯函数集合使用命名导出，让调用处明确表达依赖。
- 项目内系统级 UI 的类名、元素标识及相关样式统一使用 `kniu_sys_` 前缀，业务页面自身命名不受此约束。
- **禁止外部品牌字眼**：所有源码、注释、变量、样式、文案、资源名和构建产物统一使用项目自身命名；自动检查发现违规内容时直接阻止交付。
- **HTML 编解码后端全责（铁律）**：增 / 改 → 写库前 `Controller::encodeFields()` 单轮 `htmlspecialchars($str, ENT_QUOTES)`；查 → 返回前端前 `Controller::decodeFields()` 单轮 `htmlspecialchars_decode($str, ENT_QUOTES)`（兼容 `find` 单行 / `select` 行数组 / `null`）；删 → 不处理；**前端不做任何编解码**，单元格 / 文本插值直接 `textContent` 直出（已移除 `decodeHtml` 系）。历史脏数据由根目录 `normalise_db.php` 一次性归一（dry-run 默认，`php normalise_db.php --apply` 写库）。
- 系统 UI 优先封装为数据驱动组件；自定义组件通过现有的 `kniu:[property-name]` 绑定对象、数组或函数，业务 Controller 不直接查询和创建组件内部 DOM。
- 前端路由守卫负责交互体验，后端 Session 鉴权与角色授权是最终安全边界；退出必须调用 `POST /api/logout`。

## 安全与统一检查

- 数据库凭据只从环境变量读取，复制 `.env.example` 后在本机填写，禁止提交真实密钥。
- 后台 Cookie 使用 `HttpOnly`、`SameSite=Strict`，API 校验同源请求并返回 CSP 等安全响应头。
- 富文本进入编辑器前执行白名单清洗；上传删除路径必须位于 `public/upload/` 内。
- `npm run check` 依次运行核心测试、生产构建、项目命名门禁和 PHP 语法检查。
- `npm run benchmark` 运行核心性能基准，结果用于同一设备上的版本纵向比较。
- 新增公开页面时，同时添加 `client/views/index/<name>.html`、`client/controller/index/<name>Controller.js`，并以 `index/<name>Controller` 注册到普通路由。
- 新增后台页面时，同时添加 `client/views/admin/<name>.html`、`client/controller/admin/<name>Controller.js`，并以 `admin/<name>Controller` 注册到 `ROUTER.auth()` 鉴权分组。
- 新增公共布局时，将模板放入对应区域的 `common/`，将 Controller 放入同名区域目录，并在 `client/client.mjs` 的 `useViews()` 中使用 `区域/名称` 键装配。
- 页面和公共布局组件标识包含所在区域，前后台允许使用同名文件且不会相互覆盖。
- 后端新增接口时，在 `api/config/router.php` 注册，并将控制器放入对应应用的 `Controllers` 目录；部署到区分大小写的环境时必须保持目录名大小写正确。
- `dist/` 是生成目录，不应直接编辑。

更细的模板语法参见 `client/core/kniutemplate.md`，系统 UI 组件（`kniu-table` / `kniu-page` / `kniu-empty` / `kniu-modal` / `kniu-form` / `kniu-input` / `kniu-switch` / `kniu-editor` 等）用法参见 `client/core/kniuui.md`，后端补充说明（含 HTML 编解码、接口清单）参见 `api/API.md`。
